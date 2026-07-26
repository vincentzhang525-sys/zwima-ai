/**
 * M8 Agent Platform Phase 2A — per-agent memory policy.
 *
 * A policy row is optional: until one is written, every agent is treated as
 * having the default policy below, which has `memoryEnabled: false`. This
 * means the mere existence of the Phase 2A memory feature never turns
 * memory on for any existing or newly-created agent — an explicit
 * `admin`-permission write is required to enable it.
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

export type AgentMemoryPolicyRecord = {
  id: string;
  policyId: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  memoryEnabled: boolean;
  allowUserMemory: boolean;
  allowWorkspaceMemory: boolean;
  maxEntries: number;
  maxEntryCharacters: number;
  retentionDays: number;
  createdAt: Date;
  updatedAt: Date;
};

export const DEFAULT_MEMORY_POLICY = Object.freeze({
  memoryEnabled: false,
  allowUserMemory: false,
  allowWorkspaceMemory: false,
  maxEntries: 50,
  maxEntryCharacters: 2000,
  retentionDays: 30,
});

const newPolicyId = () => `mpo_${randomUUID()}`;
const CATALOG_EPOCH = new Date(0);

async function assertAgentInOrg(ctx: AgentContext, agentId: string): Promise<void> {
  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
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
    createdAt: CATALOG_EPOCH,
    updatedAt: CATALOG_EPOCH,
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

/** Reads the effective memory policy for an agent, defaulting to memory-disabled if no row exists. */
export async function getAgentMemoryPolicy(ctx: AgentContext, agentId: string): Promise<AgentMemoryPolicyRecord> {
  assertAgentPermission(ctx, "read");
  await assertAgentInOrg(ctx, agentId);
  const db = getAgentDb();
  const row = await db.agentMemoryPolicy.findFirst({ where: { agentId, organizationId: ctx.organizationId } });
  return row ?? defaultPolicyRecord(ctx, agentId);
}

/**
 * Best-effort variant for internal callers (e.g. `agent-runner.ts`) that must
 * never let a policy-lookup failure block a run. Falls back to the
 * memory-disabled default on any error.
 */
export async function getAgentMemoryPolicySafe(ctx: AgentContext, agentId: string): Promise<AgentMemoryPolicyRecord> {
  try {
    return await getAgentMemoryPolicy(ctx, agentId);
  } catch {
    return defaultPolicyRecord(ctx, agentId);
  }
}

/** Enabling/disabling memory (or loosening its limits) is an org-admin-level action, mirroring `archiveAgent`/`publishAgentVersion`. */
export async function upsertAgentMemoryPolicy(
  ctx: AgentContext,
  agentId: string,
  patch: UpsertAgentMemoryPolicyInput,
): Promise<AgentMemoryPolicyRecord> {
  assertAgentPermission(ctx, "admin");
  await assertAgentInOrg(ctx, agentId);
  const clamped = clampPolicyInput(patch);

  const db = getAgentDb();
  const existing = await db.agentMemoryPolicy.findFirst({ where: { agentId, organizationId: ctx.organizationId } });
  if (existing) {
    return db.agentMemoryPolicy.update({ where: { id: existing.id }, data: clamped });
  }
  return db.agentMemoryPolicy.create({
    data: {
      policyId: newPolicyId(),
      organizationId: ctx.organizationId,
      workspaceId: null,
      agentId,
      ...DEFAULT_MEMORY_POLICY,
      ...clamped,
    },
  });
}
