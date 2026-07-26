/**
 * M8 Agent Platform Phase 2A — memory read/write/delete with policy
 * enforcement and expanded secret rejection.
 *
 * Builds on `src/lib/agents/memory-service.ts` (Phase 1 hash/preview
 * storage, `looksLikeSecret`) rather than replacing it: every write here
 * still computes `valueHash`/`valuePreview` via the existing helpers, and
 * additionally persists a bounded plaintext `value` (Phase 2A additive
 * column) capped by the agent's memory policy — never the raw, unbounded
 * value, and never anything that matches the expanded secret patterns
 * below.
 */

import { randomUUID } from "crypto";
import { assertAgentPermission, type AgentContext } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import { getAgentDb, type AgentMemoryScope } from "@/lib/agents/types";
import { looksLikeSecret, redactValuePreview } from "@/lib/agents/memory-service";
import { hashText } from "@/lib/compliance/hashes";
import { getAgentMemoryPolicy, getAgentMemoryPolicySafe } from "./memory-policy-service";
import { RECENT_MEMORY_INJECTION_LIMIT } from "./agent-safety";
import type { AgentMemoryType } from "./agent-types";

export type AgentMemoryPhase2Record = {
  id: string;
  memoryId: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  runId: string | null;
  userId: string | null;
  scope: AgentMemoryScope;
  memoryType: AgentMemoryType | null;
  key: string;
  valueHash: string;
  valuePreview: string;
  value: string | null;
  metadata: unknown;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Not re-exported from the barrel (`index.ts`) — the public shape for this lives in `agent-types.ts#CreateAgentMemoryEntryInput`, which every caller outside this file should use instead. */
type CreateAgentMemoryEntryServiceInput = {
  agentId: string;
  memoryType: AgentMemoryType;
  key: string;
  value: string;
  metadata?: Record<string, unknown> | null;
};

const newMemoryId = () => `mem_${randomUUID()}`;

/**
 * Expanded Phase 2A secret-shaped-content scan, layered on top of the
 * Phase 1 `looksLikeSecret` (API-key/password/bearer/private-key). Adds:
 * live/test Stripe secret keys, Stripe webhook secrets, raw `Authorization`
 * headers, and card-like digit sequences. Any match rejects the write
 * outright — Phase 2A memory never stores plaintext that looks like a
 * credential, token, or payment card number.
 */
const PHASE2_SECRET_PATTERNS: RegExp[] = [
  /\bsk_live_[a-zA-Z0-9]{10,}\b/i,
  /\bsk_test_[a-zA-Z0-9]{10,}\b/i,
  /\bwhsec_[a-zA-Z0-9]{10,}\b/i,
  /\bre_[a-zA-Z0-9]{10,}\b/i,
  /\bAKIA[0-9A-Z]{12,}\b/,
  /authorization\s*:\s*bearer\s+[a-zA-Z0-9._-]{10,}/i,
  // Card-like digit run: 13-19 digits, optionally grouped by spaces/dashes.
  /\b(?:\d[ -]?){13,19}\b/,
];

export function looksLikeSecretPhase2(value: string): boolean {
  if (looksLikeSecret(value)) return true;
  return PHASE2_SECRET_PATTERNS.some((re) => re.test(value));
}

function memoryTypeToScope(memoryType: AgentMemoryType): AgentMemoryScope {
  if (memoryType === "WORKSPACE") return "WORKSPACE";
  if (memoryType === "EXECUTION_SUMMARY") return "RUN";
  return "CONVERSATION";
}

async function loadOwnedAgentMemory(ctx: AgentContext, agentId: string, memoryId: string) {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const row = (await db.agentMemory.findUnique({ where: { memoryId } })) as AgentMemoryPhase2Record | null;
  if (!row || row.organizationId !== ctx.organizationId || row.agentId !== agentId) {
    throw new AgentServiceError("NOT_FOUND", "Memory entry not found", 404);
  }
  return row;
}

async function assertAgentInOrg(ctx: AgentContext, agentId: string): Promise<void> {
  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
  }
}

/** Creates a Phase 2A memory entry, enforcing the agent's memory policy (must be enabled, type-allowed, size, count) and secret rejection. */
export async function createAgentMemoryEntry(
  ctx: AgentContext,
  input: CreateAgentMemoryEntryServiceInput,
): Promise<AgentMemoryPhase2Record> {
  assertAgentPermission(ctx, input.memoryType === "WORKSPACE" ? "admin" : "edit");

  const key = input.key.trim();
  const value = input.value ?? "";
  if (!key) throw new AgentServiceError("VALIDATION_ERROR", "key is required", 400);
  if (!value.trim()) throw new AgentServiceError("VALIDATION_ERROR", "value is required", 400);
  if (looksLikeSecretPhase2(value)) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      "Refusing to store secret-like content (API key/password/token/private key/card number) in agent memory",
      400,
    );
  }

  await assertAgentInOrg(ctx, input.agentId);
  const policy = await getAgentMemoryPolicy(ctx, input.agentId);
  if (!policy.memoryEnabled) {
    throw new AgentServiceError(
      "MEMORY_DISABLED",
      "Memory is disabled for this agent — enable it via the agent's memory policy first",
      409,
    );
  }
  if (input.memoryType === "USER" && !policy.allowUserMemory) {
    throw new AgentServiceError("FORBIDDEN", "User-scoped memory is not allowed by this agent's policy", 403);
  }
  if (input.memoryType === "WORKSPACE" && !policy.allowWorkspaceMemory) {
    throw new AgentServiceError("FORBIDDEN", "Workspace-scoped memory is not allowed by this agent's policy", 403);
  }
  if (value.length > policy.maxEntryCharacters) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `Memory value exceeds this agent's policy limit of ${policy.maxEntryCharacters} characters`,
      400,
    );
  }

  const db = getAgentDb();
  const existingCount = await db.agentMemory.count({ where: { organizationId: ctx.organizationId, agentId: input.agentId } });
  if (existingCount >= policy.maxEntries) {
    throw new AgentServiceError(
      "MEMORY_LIMIT_EXCEEDED",
      `Agent memory entry limit (${policy.maxEntries}) reached — delete an entry or clear memory first`,
      409,
    );
  }

  const boundedValue = value.slice(0, policy.maxEntryCharacters);
  const expiresAt = new Date(Date.now() + policy.retentionDays * 24 * 60 * 60 * 1000);

  return db.agentMemory.create({
    data: {
      memoryId: newMemoryId(),
      organizationId: ctx.organizationId,
      workspaceId: input.memoryType === "WORKSPACE" ? ctx.organizationId : null,
      agentId: input.agentId,
      runId: null,
      userId: input.memoryType === "USER" ? ctx.user.id : null,
      scope: memoryTypeToScope(input.memoryType),
      memoryType: input.memoryType,
      key,
      value: boundedValue,
      valueHash: hashText(value),
      valuePreview: redactValuePreview(value),
      metadata: input.metadata ?? null,
      expiresAt,
      createdBy: ctx.user.id,
    },
  }) as Promise<AgentMemoryPhase2Record>;
}

export async function listAgentMemoryEntries(
  ctx: AgentContext,
  agentId: string,
  params: { memoryType?: AgentMemoryType; limit?: number } = {},
): Promise<AgentMemoryPhase2Record[]> {
  assertAgentPermission(ctx, "read");
  await assertAgentInOrg(ctx, agentId);
  const db = getAgentDb();
  const rows = (await db.agentMemory.findMany({
    where: { organizationId: ctx.organizationId, agentId, memoryType: params.memoryType },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 100, 200),
  })) as AgentMemoryPhase2Record[];
  return rows;
}

export async function deleteAgentMemoryEntry(ctx: AgentContext, agentId: string, memoryId: string): Promise<void> {
  const row = await loadOwnedAgentMemory(ctx, agentId, memoryId);
  assertAgentPermission(ctx, row.scope === "WORKSPACE" ? "admin" : "edit");
  const db = getAgentDb();
  await db.agentMemory.delete({ where: { id: row.id } });
}

/** Deletes every memory entry for this agent (org-scoped) — an admin-level, irreversible action. */
export async function clearAgentMemory(ctx: AgentContext, agentId: string): Promise<{ count: number }> {
  assertAgentPermission(ctx, "admin");
  await assertAgentInOrg(ctx, agentId);
  const db = getAgentDb();
  return db.agentMemory.deleteMany({ where: { organizationId: ctx.organizationId, agentId } });
}

/**
 * Bounded, read-only loader used by `agent-runner.ts` to build the
 * memory-context block injected into a run. Returns `[]` whenever memory is
 * disabled (including on any lookup failure — best-effort, never blocks a
 * run) so callers do not need their own policy check.
 */
export async function loadRecentMemoryForExecution(
  ctx: AgentContext,
  agentId: string,
  limit: number = RECENT_MEMORY_INJECTION_LIMIT,
): Promise<AgentMemoryPhase2Record[]> {
  const policy = await getAgentMemoryPolicySafe(ctx, agentId);
  if (!policy.memoryEnabled) return [];
  try {
    const db = getAgentDb();
    const rows = (await db.agentMemory.findMany({
      where: { organizationId: ctx.organizationId, agentId },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit, RECENT_MEMORY_INJECTION_LIMIT) * 2,
    })) as AgentMemoryPhase2Record[];
    const now = Date.now();
    const active = rows.filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
    return active.slice(0, limit);
  } catch {
    return [];
  }
}
