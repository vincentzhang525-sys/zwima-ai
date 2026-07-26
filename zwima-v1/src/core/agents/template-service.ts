/**
 * M8 Agent Platform Phase 2A — agent template service.
 *
 * Merges the in-code system catalog (`template-catalog.ts`) with database
 * rows: `organizationId = null` rows are platform-admin overrides/extensions
 * of the system catalog, `organizationId = <org>` rows are workspace/customer
 * custom templates, strictly isolated to the owning organization.
 *
 * Every write path re-validates `allowedToolKeys` against the frozen Phase 1
 * `ALLOWED_TOOL_KEYS` (`assertToolKeysAllowed`) and clamps numeric limits to
 * the Phase 1 safety ceilings — a template can never grant more than Phase 1
 * already allows.
 */

import { randomUUID } from "crypto";
import { assertAgentPermission, type AgentContext } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import { getAgentDb } from "@/lib/agents/types";
import {
  ALLOWED_TOOL_KEYS,
  AGENT_RUN_TIMEOUT_MS,
  MAX_AGENT_STEPS,
  MAX_TEMPLATE_TOOL_KEYS,
  PER_RUN_COST_CEILING_USD,
} from "./agent-safety";
import { SYSTEM_AGENT_TEMPLATES, findSystemTemplate, type SystemAgentTemplate } from "./template-catalog";
import type {
  CreateAgentTemplateInput,
  ListAgentTemplatesQuery,
  UpdateAgentTemplateInput,
} from "./agent-types";

export type AgentTemplateRecord = {
  id: string;
  templateId: string;
  organizationId: string | null;
  workspaceId: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  systemPrompt: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxSteps: number;
  defaultTimeoutMs: number;
  defaultCostCeiling: number;
  allowedToolKeys: string[];
  isSystemTemplate: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const newAgentTemplateId = () => `tpl_${randomUUID()}`;

/** Stable, non-"real" timestamp used for code-defined catalog defaults that have never been persisted. */
const CATALOG_EPOCH = new Date(0);

function systemTemplateToRecord(t: SystemAgentTemplate): AgentTemplateRecord {
  return {
    id: t.templateId,
    templateId: t.templateId,
    organizationId: null,
    workspaceId: null,
    name: t.name,
    slug: t.slug,
    description: t.description,
    category: t.category,
    systemPrompt: t.systemPrompt,
    defaultModel: t.defaultModel,
    defaultTemperature: t.defaultTemperature,
    defaultMaxSteps: t.defaultMaxSteps,
    defaultTimeoutMs: t.defaultTimeoutMs,
    defaultCostCeiling: t.defaultCostCeiling,
    allowedToolKeys: [...t.allowedToolKeys],
    isSystemTemplate: true,
    isActive: true,
    createdBy: null,
    createdAt: CATALOG_EPOCH,
    updatedAt: CATALOG_EPOCH,
  };
}

/** Defense-in-depth re-check: throws TOOL_NOT_ALLOWED for any key outside the frozen Phase 1 allowlist. Called at template create/update time AND again at from-template agent-creation time. */
export function assertToolKeysAllowed(keys: readonly string[]): void {
  for (const key of keys) {
    if (!(ALLOWED_TOOL_KEYS as readonly string[]).includes(key)) {
      throw new AgentServiceError("TOOL_NOT_ALLOWED", `Tool '${key}' is not on the Phase 1 allowlist`, 403);
    }
  }
  if (keys.length > MAX_TEMPLATE_TOOL_KEYS) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `A template may reference at most ${MAX_TEMPLATE_TOOL_KEYS} tool keys`,
      400,
    );
  }
}

/** Clamps/validates template numeric limits against the Phase 1 hard ceilings — never allow a template to request more than Phase 1 already grants. */
function assertWithinPhase1Ceilings(input: {
  defaultMaxSteps?: number;
  defaultTimeoutMs?: number;
  defaultCostCeiling?: number;
}): void {
  if (input.defaultMaxSteps !== undefined && input.defaultMaxSteps > MAX_AGENT_STEPS) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `defaultMaxSteps (${input.defaultMaxSteps}) may not exceed the Phase 1 ceiling of ${MAX_AGENT_STEPS}`,
      400,
    );
  }
  if (input.defaultTimeoutMs !== undefined && input.defaultTimeoutMs > AGENT_RUN_TIMEOUT_MS) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `defaultTimeoutMs (${input.defaultTimeoutMs}) may not exceed the Phase 1 ceiling of ${AGENT_RUN_TIMEOUT_MS}`,
      400,
    );
  }
  if (input.defaultCostCeiling !== undefined && input.defaultCostCeiling > PER_RUN_COST_CEILING_USD) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `defaultCostCeiling (${input.defaultCostCeiling}) may not exceed the Phase 1 ceiling of $${PER_RUN_COST_CEILING_USD}`,
      400,
    );
  }
}

function defaultsFor(input: Partial<CreateAgentTemplateInput>) {
  return {
    defaultModel: input.defaultModel?.trim() || "mock-standard-v1",
    defaultTemperature: input.defaultTemperature ?? 0.5,
    defaultMaxSteps: input.defaultMaxSteps ?? MAX_AGENT_STEPS,
    defaultTimeoutMs: input.defaultTimeoutMs ?? AGENT_RUN_TIMEOUT_MS,
    defaultCostCeiling: input.defaultCostCeiling ?? PER_RUN_COST_CEILING_USD,
  };
}

async function findDbRowByTemplateId(templateId: string): Promise<AgentTemplateRecord | null> {
  const db = getAgentDb();
  return db.agentTemplate.findFirst({ where: { templateId } });
}

/**
 * Lists templates visible to the caller: every system template (catalog,
 * shadowed by an admin override row if one exists) plus the caller's own
 * organization's custom templates. Never returns another org's custom
 * templates — that is the Phase 2A template-isolation guarantee.
 */
export async function listAgentTemplates(
  ctx: AgentContext,
  query: ListAgentTemplatesQuery = {},
): Promise<AgentTemplateRecord[]> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();

  const systemOverrides = await db.agentTemplate.findMany({ where: { organizationId: null } });
  const overrideByTemplateId = new Map(systemOverrides.map((row) => [row.templateId, row]));

  const catalogRows = SYSTEM_AGENT_TEMPLATES.map(
    (t) => overrideByTemplateId.get(t.templateId) ?? systemTemplateToRecord(t),
  );
  const extraAdminSystemRows = systemOverrides.filter((row) => !findSystemTemplate(row.templateId));

  const orgRows = await db.agentTemplate.findMany({ where: { organizationId: ctx.organizationId } });

  let all = [...catalogRows, ...extraAdminSystemRows, ...orgRows];
  if (query.category) all = all.filter((t) => t.category === query.category);
  if (!query.includeInactive) all = all.filter((t) => t.isActive);
  return all;
}

/** Resolves one template by public `templateId`, enforcing org isolation for custom templates. */
export async function getAgentTemplate(ctx: AgentContext, templateId: string): Promise<AgentTemplateRecord> {
  assertAgentPermission(ctx, "read");
  const catalog = findSystemTemplate(templateId);
  if (catalog) {
    const override = await findDbRowByTemplateId(templateId);
    return override ?? systemTemplateToRecord(catalog);
  }
  const row = await findDbRowByTemplateId(templateId);
  if (!row) throw new AgentServiceError("NOT_FOUND", "Template not found", 404);
  if (!row.isSystemTemplate && row.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Template not found", 404);
  }
  return row;
}

export async function createAgentTemplate(
  ctx: AgentContext,
  input: CreateAgentTemplateInput,
): Promise<AgentTemplateRecord> {
  assertAgentPermission(ctx, "edit");
  const wantsSystem = Boolean(input.isSystemTemplate);
  if (wantsSystem && !ctx.platformAdmin) {
    throw new AgentServiceError(
      "FORBIDDEN",
      "Only a platform admin may create a system template",
      403,
    );
  }

  const name = input.name.trim();
  const slug = input.slug.trim();
  const category = input.category.trim();
  const systemPrompt = input.systemPrompt.trim();
  const allowedToolKeys = [...new Set((input.allowedToolKeys ?? []).map((k) => k.trim()).filter(Boolean))];
  assertToolKeysAllowed(allowedToolKeys);
  assertWithinPhase1Ceilings(input);

  const organizationId = wantsSystem ? null : ctx.organizationId;

  if (wantsSystem && SYSTEM_AGENT_TEMPLATES.some((t) => t.slug === slug)) {
    throw new AgentServiceError("CONFLICT", `A system template with slug '${slug}' already exists`, 409);
  }

  const db = getAgentDb();
  const existingSlug = await db.agentTemplate.findFirst({ where: { organizationId, slug } });
  if (existingSlug) {
    throw new AgentServiceError("CONFLICT", `A template with slug '${slug}' already exists`, 409);
  }

  const defaults = defaultsFor(input);
  return db.agentTemplate.create({
    data: {
      templateId: newAgentTemplateId(),
      organizationId,
      workspaceId: wantsSystem ? null : input.workspaceId ?? null,
      name,
      slug,
      description: input.description ?? null,
      category,
      systemPrompt,
      ...defaults,
      allowedToolKeys,
      isSystemTemplate: wantsSystem,
      isActive: input.isActive ?? true,
      createdBy: ctx.user.id,
    },
  });
}

export async function updateAgentTemplate(
  ctx: AgentContext,
  templateId: string,
  patch: UpdateAgentTemplateInput,
): Promise<AgentTemplateRecord> {
  assertAgentPermission(ctx, "edit");
  const catalog = findSystemTemplate(templateId);
  const existingRow = await findDbRowByTemplateId(templateId);
  const isSystem = catalog ? true : Boolean(existingRow?.isSystemTemplate);

  if (isSystem && !ctx.platformAdmin) {
    throw new AgentServiceError(
      "FORBIDDEN",
      "System templates are read-only for non-platform-admin users",
      403,
    );
  }
  if (!isSystem) {
    if (!existingRow || existingRow.organizationId !== ctx.organizationId) {
      throw new AgentServiceError("NOT_FOUND", "Template not found", 404);
    }
  }

  if (patch.allowedToolKeys) assertToolKeysAllowed(patch.allowedToolKeys);
  assertWithinPhase1Ceilings(patch);

  const base = existingRow ?? (catalog ? systemTemplateToRecord(catalog) : null);
  if (!base) throw new AgentServiceError("NOT_FOUND", "Template not found", 404);

  const merged: AgentTemplateRecord = {
    ...base,
    name: patch.name?.trim() ?? base.name,
    slug: patch.slug?.trim() ?? base.slug,
    description: patch.description !== undefined ? patch.description : base.description,
    category: patch.category?.trim() ?? base.category,
    systemPrompt: patch.systemPrompt?.trim() ?? base.systemPrompt,
    defaultModel: patch.defaultModel?.trim() ?? base.defaultModel,
    defaultTemperature: patch.defaultTemperature ?? base.defaultTemperature,
    defaultMaxSteps: patch.defaultMaxSteps ?? base.defaultMaxSteps,
    defaultTimeoutMs: patch.defaultTimeoutMs ?? base.defaultTimeoutMs,
    defaultCostCeiling: patch.defaultCostCeiling ?? base.defaultCostCeiling,
    allowedToolKeys: patch.allowedToolKeys
      ? [...new Set(patch.allowedToolKeys.map((k) => k.trim()).filter(Boolean))]
      : base.allowedToolKeys,
    isActive: patch.isActive ?? base.isActive,
  };

  const db = getAgentDb();
  if (existingRow) {
    return db.agentTemplate.update({
      where: { id: existingRow.id },
      data: {
        name: merged.name,
        slug: merged.slug,
        description: merged.description,
        category: merged.category,
        systemPrompt: merged.systemPrompt,
        defaultModel: merged.defaultModel,
        defaultTemperature: merged.defaultTemperature,
        defaultMaxSteps: merged.defaultMaxSteps,
        defaultTimeoutMs: merged.defaultTimeoutMs,
        defaultCostCeiling: merged.defaultCostCeiling,
        allowedToolKeys: merged.allowedToolKeys,
        isActive: merged.isActive,
      },
    });
  }

  // First mutation of a catalog-only system template: materializes an
  // override row (organizationId = null) so future reads reflect it. The
  // in-code catalog entry itself is never modified.
  return db.agentTemplate.create({
    data: {
      templateId,
      organizationId: null,
      workspaceId: null,
      name: merged.name,
      slug: merged.slug,
      description: merged.description,
      category: merged.category,
      systemPrompt: merged.systemPrompt,
      defaultModel: merged.defaultModel,
      defaultTemperature: merged.defaultTemperature,
      defaultMaxSteps: merged.defaultMaxSteps,
      defaultTimeoutMs: merged.defaultTimeoutMs,
      defaultCostCeiling: merged.defaultCostCeiling,
      allowedToolKeys: merged.allowedToolKeys,
      isSystemTemplate: true,
      isActive: merged.isActive,
      createdBy: ctx.user.id,
    },
  });
}

export async function deleteAgentTemplate(ctx: AgentContext, templateId: string): Promise<void> {
  assertAgentPermission(ctx, "admin");
  const catalog = findSystemTemplate(templateId);
  const existingRow = await findDbRowByTemplateId(templateId);
  const isSystem = catalog ? true : Boolean(existingRow?.isSystemTemplate);

  // Permission is checked before existence/conflict so a non-platform-admin
  // always gets a consistent FORBIDDEN for any system template, catalog-only
  // or not — mirroring `updateAgentTemplate`'s ordering.
  if (isSystem && !ctx.platformAdmin) {
    throw new AgentServiceError(
      "FORBIDDEN",
      "System templates are read-only for non-platform-admin users",
      403,
    );
  }
  if (catalog && !existingRow) {
    throw new AgentServiceError(
      "CONFLICT",
      "Built-in system templates cannot be deleted — deactivate them instead (isActive: false)",
      409,
    );
  }
  if (!existingRow) {
    throw new AgentServiceError("NOT_FOUND", "Template not found", 404);
  }
  if (!existingRow.isSystemTemplate && existingRow.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Template not found", 404);
  }

  const db = getAgentDb();
  await db.agentTemplate.delete({ where: { id: existingRow.id } });
}
