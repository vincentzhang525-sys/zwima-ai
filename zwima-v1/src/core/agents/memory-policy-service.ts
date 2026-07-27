/**
 * M8 Agent Platform Phase 2A/2B — per-agent memory policy.
 *
 * Phase 2B extensions (allowAgentMemory / allowRead / allowExecutionSummaryWrite)
 * are stored in AgentVersion.config.phase2bMemoryExt — no Prisma migration.
 * allowWorkspaceMemory cannot be enabled (WORKSPACE fail-closed).
 */

import { randomUUID } from "crypto";
import { assertAgentPermission, type AgentContext } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import { getAgentDb } from "@/lib/agents/types";
import {
  MAX_MEMORY_POLICY_ENTRIES_CLAMP,
  MAX_MEMORY_POLICY_ENTRY_CHARS_CLAMP,
  MAX_MEMORY_POLICY_RETENTION_DAYS_CLAMP,
} from "./agent-safety";
import type { UpsertAgentMemoryPolicyInput } from "./agent-types";

export type Phase2bMemoryPolicyExt = {
  allowAgentMemory: boolean;
  allowRead: boolean;
  allowExecutionSummaryWrite: boolean;
};

export type AgentMemoryPolicyRecord = {
  id: string;
  policyId: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  memoryEnabled: boolean;
  allowUserMemory: boolean;
  /** Always false / non-enabling in Phase 2B. */
  allowWorkspaceMemory: boolean;
  allowAgentMemory: boolean;
  allowRead: boolean;
  allowExecutionSummaryWrite: boolean;
  maxEntries: number;
  maxEntryCharacters: number;
  retentionDays: number;
  createdAt: Date;
  updatedAt: Date;
  workspaceMemoryDeferred: true;
  workspaceMemoryUnavailableReason: "WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE";
};

export const DEFAULT_MEMORY_POLICY = Object.freeze({
  memoryEnabled: false,
  allowUserMemory: false,
  allowWorkspaceMemory: false,
  maxEntries: 50,
  maxEntryCharacters: 2000,
  retentionDays: 30,
});

export const DEFAULT_PHASE2B_EXT: Phase2bMemoryPolicyExt = Object.freeze({
  allowAgentMemory: false,
  allowRead: true,
  allowExecutionSummaryWrite: true,
});

const newPolicyId = () => `mpo_${randomUUID()}`;
const CATALOG_EPOCH = new Date(0);

const WORKSPACE_UNAVAILABLE_MSG =
  "Workspace memory is temporarily unavailable until authenticated workspace binding is enabled.";

async function assertAgentInOrg(ctx: AgentContext, agentId: string): Promise<{ status: string; currentVersionId: string | null }> {
  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
  }
  return { status: agent.status as string, currentVersionId: (agent.currentVersionId as string | null) ?? null };
}

export function assertAgentNotArchived(status: string): void {
  if (status === "ARCHIVED" || status === "DEPRECATED") {
    throw new AgentServiceError(
      "AGENT_ARCHIVED",
      `Agent is ${status.toLowerCase()} — memory read/write is disabled`,
      409,
    );
  }
}

function defaultPolicyRecord(ctx: AgentContext, agentId: string): AgentMemoryPolicyRecord {
  return {
    id: `default_${agentId}`,
    policyId: `default_${agentId}`,
    organizationId: ctx.organizationId,
    workspaceId: null,
    agentId,
    ...DEFAULT_MEMORY_POLICY,
    ...DEFAULT_PHASE2B_EXT,
    createdAt: CATALOG_EPOCH,
    updatedAt: CATALOG_EPOCH,
    workspaceMemoryDeferred: true,
    workspaceMemoryUnavailableReason: "WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE",
  };
}

function clampPolicyInput(patch: UpsertAgentMemoryPolicyInput): UpsertAgentMemoryPolicyInput {
  const clamped: UpsertAgentMemoryPolicyInput = { ...patch };
  if (clamped.maxEntries !== undefined) {
    clamped.maxEntries = Math.max(1, Math.min(MAX_MEMORY_POLICY_ENTRIES_CLAMP, Math.floor(clamped.maxEntries)));
  }
  if (clamped.maxEntryCharacters !== undefined) {
    clamped.maxEntryCharacters = Math.max(
      1,
      Math.min(MAX_MEMORY_POLICY_ENTRY_CHARS_CLAMP, Math.floor(clamped.maxEntryCharacters)),
    );
  }
  if (clamped.retentionDays !== undefined) {
    clamped.retentionDays = Math.max(
      1,
      Math.min(MAX_MEMORY_POLICY_RETENTION_DAYS_CLAMP, Math.floor(clamped.retentionDays)),
    );
  }
  return clamped;
}

function readExtFromConfig(config: unknown): Phase2bMemoryPolicyExt {
  if (!config || typeof config !== "object") return { ...DEFAULT_PHASE2B_EXT };
  const raw = (config as Record<string, unknown>).phase2bMemoryExt;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PHASE2B_EXT };
  const ext = raw as Record<string, unknown>;
  return {
    allowAgentMemory: typeof ext.allowAgentMemory === "boolean" ? ext.allowAgentMemory : DEFAULT_PHASE2B_EXT.allowAgentMemory,
    allowRead: typeof ext.allowRead === "boolean" ? ext.allowRead : DEFAULT_PHASE2B_EXT.allowRead,
    allowExecutionSummaryWrite:
      typeof ext.allowExecutionSummaryWrite === "boolean"
        ? ext.allowExecutionSummaryWrite
        : DEFAULT_PHASE2B_EXT.allowExecutionSummaryWrite,
  };
}

async function loadPhase2bExt(agentId: string, currentVersionId: string | null): Promise<Phase2bMemoryPolicyExt> {
  if (!currentVersionId) return { ...DEFAULT_PHASE2B_EXT };
  const db = getAgentDb();
  const version = await db.agentVersion.findUnique({ where: { versionId: currentVersionId } });
  if (!version) return { ...DEFAULT_PHASE2B_EXT };
  return readExtFromConfig(version.config);
}

async function persistPhase2bExt(
  agentId: string,
  currentVersionId: string | null,
  ext: Phase2bMemoryPolicyExt,
): Promise<void> {
  if (!currentVersionId) return;
  const db = getAgentDb();
  const version = await db.agentVersion.findUnique({ where: { versionId: currentVersionId } });
  if (!version) return;
  const prev =
    version.config && typeof version.config === "object" ? (version.config as Record<string, unknown>) : {};
  await db.agentVersion.update({
    where: { id: version.id },
    data: { config: { ...prev, phase2bMemoryExt: ext } },
  });
}

function mergePolicyRow(
  ctx: AgentContext,
  agentId: string,
  row: Record<string, unknown> | null,
  ext: Phase2bMemoryPolicyExt,
): AgentMemoryPolicyRecord {
  if (!row) return { ...defaultPolicyRecord(ctx, agentId), ...ext };
  return {
    id: String(row.id),
    policyId: String(row.policyId),
    organizationId: String(row.organizationId),
    workspaceId: (row.workspaceId as string | null) ?? null,
    agentId: String(row.agentId),
    memoryEnabled: Boolean(row.memoryEnabled),
    allowUserMemory: Boolean(row.allowUserMemory),
    // Phase 2B: never treat DB flag as enabling WORKSPACE operations.
    allowWorkspaceMemory: false,
    allowAgentMemory: ext.allowAgentMemory,
    allowRead: ext.allowRead,
    allowExecutionSummaryWrite: ext.allowExecutionSummaryWrite,
    maxEntries: Number(row.maxEntries),
    maxEntryCharacters: Number(row.maxEntryCharacters),
    retentionDays: Number(row.retentionDays),
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    workspaceMemoryDeferred: true,
    workspaceMemoryUnavailableReason: "WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE",
  };
}

/** Reads the effective memory policy for an agent, defaulting to memory-disabled if no row exists. */
export async function getAgentMemoryPolicy(ctx: AgentContext, agentId: string): Promise<AgentMemoryPolicyRecord> {
  assertAgentPermission(ctx, "read");
  const agentMeta = await assertAgentInOrg(ctx, agentId);
  const db = getAgentDb();
  const row = await db.agentMemoryPolicy.findFirst({ where: { agentId, organizationId: ctx.organizationId } });
  const ext = await loadPhase2bExt(agentId, agentMeta.currentVersionId);
  return mergePolicyRow(ctx, agentId, row as Record<string, unknown> | null, ext);
}

export async function getAgentMemoryPolicySafe(ctx: AgentContext, agentId: string): Promise<AgentMemoryPolicyRecord> {
  try {
    return await getAgentMemoryPolicy(ctx, agentId);
  } catch {
    return defaultPolicyRecord(ctx, agentId);
  }
}

/** Enabling/disabling memory (or loosening its limits) is an org-admin-level action. */
export async function upsertAgentMemoryPolicy(
  ctx: AgentContext,
  agentId: string,
  patch: UpsertAgentMemoryPolicyInput,
): Promise<AgentMemoryPolicyRecord> {
  assertAgentPermission(ctx, "admin");
  const agentMeta = await assertAgentInOrg(ctx, agentId);
  assertAgentNotArchived(agentMeta.status);

  if (patch.allowWorkspaceMemory === true) {
    throw new AgentServiceError(
      "WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE",
      WORKSPACE_UNAVAILABLE_MSG,
      409,
    );
  }

  const clamped = clampPolicyInput(patch);
  const { allowAgentMemory, allowRead, allowExecutionSummaryWrite, ...rest } = clamped;
  // Strip allowWorkspaceMemory from DB patch — never persist true; force false.
  const { allowWorkspaceMemory: _ws, ...dbPatch } = rest;
  void _ws;

  const db = getAgentDb();
  const existing = await db.agentMemoryPolicy.findFirst({ where: { agentId, organizationId: ctx.organizationId } });
  // Never persist allowWorkspaceMemory=true.
  const safeDbPatch = { ...dbPatch, allowWorkspaceMemory: false };

  let row;
  if (existing) {
    row = await db.agentMemoryPolicy.update({ where: { id: existing.id }, data: safeDbPatch });
  } else {
    row = await db.agentMemoryPolicy.create({
      data: {
        policyId: newPolicyId(),
        organizationId: ctx.organizationId,
        workspaceId: null,
        agentId,
        ...DEFAULT_MEMORY_POLICY,
        ...safeDbPatch,
      },
    });
  }

  const prevExt = await loadPhase2bExt(agentId, agentMeta.currentVersionId);
  const nextExt: Phase2bMemoryPolicyExt = {
    allowAgentMemory: typeof allowAgentMemory === "boolean" ? allowAgentMemory : prevExt.allowAgentMemory,
    allowRead: typeof allowRead === "boolean" ? allowRead : prevExt.allowRead,
    allowExecutionSummaryWrite:
      typeof allowExecutionSummaryWrite === "boolean" ? allowExecutionSummaryWrite : prevExt.allowExecutionSummaryWrite,
  };
  await persistPhase2bExt(agentId, agentMeta.currentVersionId, nextExt);

  return mergePolicyRow(ctx, agentId, row as Record<string, unknown>, nextExt);
}

export { WORKSPACE_UNAVAILABLE_MSG };
