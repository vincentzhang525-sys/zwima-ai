/**
 * M8 Agent Platform Phase 2A — create an AgentDefinition + AgentVersion from
 * a template.
 *
 * The template's fields are copied into the new `AgentVersion` at creation
 * time only — this is an immutable snapshot. Nothing about the created
 * agent re-reads the template afterwards (no foreign key to
 * `AgentTemplate`), so editing or deleting a template later never changes
 * agents that were already created from it.
 */

import { assertAgentPermission, type AgentContext } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import { createAgent as libCreateAgent } from "@/lib/agents/registry-service";
import { getAgentTemplate, assertToolKeysAllowed } from "./template-service";
import type { Agent, AgentVersion, CreateAgentFromTemplateInput } from "./agent-types";

export async function createAgentFromTemplate(
  ctx: AgentContext,
  input: CreateAgentFromTemplateInput,
): Promise<{ agent: Agent; version: AgentVersion; templateId: string; templateSlug: string }> {
  assertAgentPermission(ctx, "edit");

  const template = await getAgentTemplate(ctx, input.templateId);
  if (!template.isActive) {
    throw new AgentServiceError("CONFLICT", `Template '${input.templateId}' is not active`, 409);
  }

  // Tool revalidation: re-check the template's stored tool keys against the
  // *current* Phase 1 allowlist at agent-creation time, rather than trusting
  // whatever was valid when the template itself was created/updated.
  assertToolKeysAllowed(template.allowedToolKeys);

  const name = input.name?.trim() || template.name;
  const result = await libCreateAgent(ctx, {
    name,
    description: template.description,
    workspaceId: input.workspaceId ?? template.workspaceId ?? null,
    systemPrompt: template.systemPrompt,
    model: template.defaultModel,
    temperature: template.defaultTemperature,
    toolIds: [...template.allowedToolKeys],
    reviewRequired: false,
    config: {
      // Informational snapshot only — never re-read live from AgentTemplate.
      fromTemplateId: template.templateId,
      fromTemplateSlug: template.slug,
      fromTemplateSnapshotAt: new Date().toISOString(),
      templateDefaultMaxSteps: template.defaultMaxSteps,
      templateDefaultTimeoutMs: template.defaultTimeoutMs,
      templateDefaultCostCeiling: template.defaultCostCeiling,
    },
  });

  return { ...result, templateId: template.templateId, templateSlug: template.slug };
}
