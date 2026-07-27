/**
 * M8 Agent Platform Phase 2A/2B — memory read/write/delete with policy
 * enforcement, USER isolation, AGENT isolation, WORKSPACE fail-closed,
 * rate limits, and expanded secret rejection.
 *
 * AGENT memory is stored without a Prisma AgentMemoryType enum value
 * (metadata.phase2bKind = "AGENT") — no migration in Phase 2B.
 * WORKSPACE memory is always rejected with WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE.
 */

import { randomUUID } from "crypto";
import { assertAgentPermission, type AgentContext } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import { getAgentDb, type AgentMemoryScope } from "@/lib/agents/types";
import { looksLikeSecret, redactValuePreview } from "@/lib/agents/memory-service";
import { hashText } from "@/lib/compliance/hashes";
import {
  assertAgentNotArchived,
  getAgentMemoryPolicy,
  getAgentMemoryPolicySafe,
  WORKSPACE_UNAVAILABLE_MSG,
} from "./memory-policy-service";
import { assertMemoryWriteRateLimit } from "./memory-rate-limit";
import { sanitizeMemoryContentForInjection } from "./memory-sanitize";
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
  /** Application-level kind; AGENT is synthetic (not a Prisma enum value). */
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

type CreateAgentMemoryEntryServiceInput = {
  agentId: string;
  memoryType: AgentMemoryType;
  key: string;
  value: string;
  metadata?: Record<string, unknown> | null;
  /** When true, oversized values are truncated instead of rejected (auto summaries). */
  truncateOnOversize?: boolean;
  /** Skip rate limit (reserved; prefer always enforcing). */
  skipRateLimit?: boolean;
};

const newMemoryId = () => `mem_${randomUUID()}`;
const AGENT_KIND_META = "AGENT" as const;

/**
 * Expanded Phase 2B secret-shaped-content scan, layered on Phase 1 looksLikeSecret.
 */
const PHASE2_SECRET_PATTERNS: RegExp[] = [
  /\bsk_live_[a-zA-Z0-9]{10,}\b/i,
  /\bsk_test_[a-zA-Z0-9]{10,}\b/i,
  /\bwhsec_[a-zA-Z0-9]{10,}\b/i,
  /\bre_[a-zA-Z0-9]{10,}\b/i,
  /\bAKIA[0-9A-Z]{12,}\b/,
  /authorization\s*:\s*bearer\s+[a-zA-Z0-9._-]{10,}/i,
  /\bbearer\s+[a-zA-Z0-9._-]{20,}\b/i,
  /\b(?:\d[ -]?){13,19}\b/,
  /postgres(?:ql)?:\/\/\S+/i,
  /mysql:\/\/\S+/i,
  /mongodb(?:\+srv)?:\/\/\S+/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\bsk_(?:live|test)_[a-zA-Z0-9]{8,}\b/i,
  /\bCLERK_SECRET_KEY\b/i,
  /\bsk_clerk_[a-zA-Z0-9]{10,}\b/i,
  /\bre_[A-Za-z0-9]{20,}\b/,
  /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/i,
  /\bsk-proj-[a-zA-Z0-9_-]{20,}\b/i,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /cookie\s*[:=]\s*[^\s;]{16,}/i,
  /(?:^|[\s;])session(?:id|_id|token)?\s*[:=]\s*[A-Za-z0-9._-]{16,}/i,
];

export function looksLikeSecretPhase2(value: string): boolean {
  if (looksLikeSecret(value)) return true;
  return PHASE2_SECRET_PATTERNS.some((re) => re.test(value));
}

function throwSensitive(): never {
  throw new AgentServiceError(
    "MEMORY_CONTAINS_SENSITIVE_DATA",
    "Refusing to store secret-like content in agent memory",
    400,
  );
}

function throwWorkspaceUnavailable(): never {
  throw new AgentServiceError("WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE", WORKSPACE_UNAVAILABLE_MSG, 409);
}

function isAgentKindMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).phase2bKind === AGENT_KIND_META;
}

/** Maps a DB row to the application-level memoryType (AGENT via metadata). */
export function resolveApplicationMemoryType(row: {
  memoryType?: string | null;
  metadata?: unknown;
}): AgentMemoryType | null {
  if (isAgentKindMetadata(row.metadata)) return "AGENT";
  if (row.memoryType === "USER" || row.memoryType === "WORKSPACE" || row.memoryType === "EXECUTION_SUMMARY") {
    return row.memoryType;
  }
  return null;
}

function toPhase2Record(row: Record<string, unknown>): AgentMemoryPhase2Record {
  const appType = resolveApplicationMemoryType({
    memoryType: row.memoryType as string | null,
    metadata: row.metadata,
  });
  return {
    id: String(row.id),
    memoryId: String(row.memoryId),
    organizationId: String(row.organizationId),
    workspaceId: (row.workspaceId as string | null) ?? null,
    agentId: String(row.agentId),
    runId: (row.runId as string | null) ?? null,
    userId: (row.userId as string | null) ?? null,
    scope: row.scope as AgentMemoryScope,
    memoryType: appType,
    key: String(row.key),
    valueHash: String(row.valueHash),
    valuePreview: String(row.valuePreview),
    value: (row.value as string | null) ?? null,
    metadata: row.metadata,
    expiresAt: (row.expiresAt as Date | null) ?? null,
    createdBy: String(row.createdBy),
    createdAt: row.createdAt as Date,
    updatedAt: (row.updatedAt as Date) ?? (row.createdAt as Date),
  };
}

function isExpired(row: { expiresAt?: Date | null }): boolean {
  if (!row.expiresAt) return false;
  return new Date(row.expiresAt).getTime() <= Date.now();
}

function memoryTypeToScope(memoryType: AgentMemoryType): AgentMemoryScope {
  if (memoryType === "WORKSPACE") return "WORKSPACE";
  if (memoryType === "EXECUTION_SUMMARY") return "RUN";
  return "CONVERSATION";
}

async function loadOwnedAgent(ctx: AgentContext, agentId: string) {
  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
  }
  return agent as { agentId: string; organizationId: string; status: string };
}

async function loadOwnedAgentMemory(ctx: AgentContext, agentId: string, memoryId: string) {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const row = await db.agentMemory.findUnique({ where: { memoryId } });
  if (!row || row.organizationId !== ctx.organizationId || row.agentId !== agentId) {
    throw new AgentServiceError("NOT_FOUND", "Memory entry not found", 404);
  }
  const record = toPhase2Record(row as Record<string, unknown>);
  if (record.memoryType === "WORKSPACE") throwWorkspaceUnavailable();
  if (record.memoryType === "USER" && record.userId !== ctx.user.id) {
    throw new AgentServiceError("NOT_FOUND", "Memory entry not found", 404);
  }
  return record;
}

function assertNoClientWorkspaceIdForgery(metadata?: Record<string, unknown> | null): void {
  if (!metadata) return;
  if ("workspaceId" in metadata) {
    throw new AgentServiceError(
      "WORKSPACE_MEMORY_CONTEXT_UNAVAILABLE",
      "Client-supplied workspaceId is not accepted for memory operations",
      409,
    );
  }
}

/** Creates a Phase 2B memory entry with isolation, policy, rate-limit, and secret checks. */
export async function createAgentMemoryEntry(
  ctx: AgentContext,
  input: CreateAgentMemoryEntryServiceInput,
): Promise<AgentMemoryPhase2Record> {
  assertNoClientWorkspaceIdForgery(input.metadata);

  if (input.memoryType === "WORKSPACE") throwWorkspaceUnavailable();

  const perm = input.memoryType === "AGENT" ? "edit" : input.memoryType === "EXECUTION_SUMMARY" ? "edit" : "edit";
  assertAgentPermission(ctx, perm);

  const key = input.key.trim();
  let value = input.value ?? "";
  if (!key) throw new AgentServiceError("VALIDATION_ERROR", "key is required", 400);
  if (!value.trim()) throw new AgentServiceError("VALIDATION_ERROR", "value is required", 400);

  if (looksLikeSecretPhase2(value)) {
    if (input.truncateOnOversize) {
      // Auto summary: redact rather than store secrets
      value = "[redacted: sensitive content removed from execution summary]";
    } else {
      throwSensitive();
    }
  }

  const agent = await loadOwnedAgent(ctx, input.agentId);
  assertAgentNotArchived(agent.status);

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
  if (input.memoryType === "AGENT" && !policy.allowAgentMemory) {
    throw new AgentServiceError("FORBIDDEN", "Agent-scoped memory is not allowed by this agent's policy", 403);
  }
  if (input.memoryType === "EXECUTION_SUMMARY" && !policy.allowExecutionSummaryWrite) {
    throw new AgentServiceError("FORBIDDEN", "Execution-summary memory writes are not allowed by this agent's policy", 403);
  }

  if (!input.skipRateLimit) {
    assertMemoryWriteRateLimit(ctx.organizationId, input.agentId, ctx.user.id);
  }

  if (value.length > policy.maxEntryCharacters) {
    if (input.truncateOnOversize) {
      value = value.slice(0, policy.maxEntryCharacters);
    } else {
      throw new AgentServiceError(
        "VALIDATION_ERROR",
        `Memory value exceeds this agent's policy limit of ${policy.maxEntryCharacters} characters`,
        400,
      );
    }
  }

  const db = getAgentDb();
  let existingCount = await db.agentMemory.count({
    where: { organizationId: ctx.organizationId, agentId: input.agentId },
  });

  if (existingCount >= policy.maxEntries) {
    if (input.memoryType === "EXECUTION_SUMMARY") {
      // Prefer cleaning oldest auto summaries (never silent-delete manual USER/AGENT).
      const summaries = (await db.agentMemory.findMany({
        where: { organizationId: ctx.organizationId, agentId: input.agentId, memoryType: "EXECUTION_SUMMARY" },
        orderBy: { createdAt: "asc" },
        take: 5,
      })) as Array<Record<string, unknown>>;
      if (summaries.length > 0) {
        await db.agentMemory.delete({ where: { id: summaries[0].id } });
        existingCount -= 1;
      }
    }
    if (existingCount >= policy.maxEntries) {
      throw new AgentServiceError(
        "MEMORY_LIMIT_EXCEEDED",
        `Agent memory entry limit (${policy.maxEntries}) reached — delete an entry or clear memory first`,
        409,
      );
    }
  }

  const boundedValue = value.slice(0, policy.maxEntryCharacters);
  const expiresAt = new Date(Date.now() + policy.retentionDays * 24 * 60 * 60 * 1000);

  const isAgentKind = input.memoryType === "AGENT";
  const metadata = {
    ...(input.metadata ?? {}),
    ...(isAgentKind ? { phase2bKind: AGENT_KIND_META } : {}),
  };

  const created = await db.agentMemory.create({
    data: {
      memoryId: newMemoryId(),
      organizationId: ctx.organizationId,
      // Never store organizationId as workspaceId. WORKSPACE path is fail-closed.
      workspaceId: null,
      agentId: input.agentId,
      runId: null,
      userId: input.memoryType === "USER" ? ctx.user.id : null,
      scope: memoryTypeToScope(input.memoryType),
      // AGENT has no Prisma enum value — persist null + metadata.phase2bKind.
      memoryType: isAgentKind ? null : input.memoryType,
      key,
      value: boundedValue,
      valueHash: hashText(boundedValue),
      valuePreview: redactValuePreview(boundedValue),
      metadata,
      expiresAt,
      createdBy: ctx.user.id,
    },
  });

  return toPhase2Record(created as Record<string, unknown>);
}

export async function listAgentMemoryEntries(
  ctx: AgentContext,
  agentId: string,
  params: { memoryType?: AgentMemoryType; limit?: number } = {},
): Promise<AgentMemoryPhase2Record[]> {
  assertAgentPermission(ctx, "read");
  if (params.memoryType === "WORKSPACE") throwWorkspaceUnavailable();

  const agent = await loadOwnedAgent(ctx, agentId);
  assertAgentNotArchived(agent.status);

  const db = getAgentDb();
  const rows = (await db.agentMemory.findMany({
    where: { organizationId: ctx.organizationId, agentId },
    orderBy: { createdAt: "desc" },
    take: Math.min((params.limit ?? 100) * 2, 400),
  })) as Array<Record<string, unknown>>;

  const mapped = rows.map(toPhase2Record).filter((r) => {
    if (r.memoryType === "WORKSPACE") return false;
    if (isExpired(r)) return false;
    if (r.memoryType === "USER" && r.userId !== ctx.user.id) return false;
    if (params.memoryType && r.memoryType !== params.memoryType) return false;
    return true;
  });

  return mapped.slice(0, Math.min(params.limit ?? 100, 200));
}

export async function deleteAgentMemoryEntry(ctx: AgentContext, agentId: string, memoryId: string): Promise<void> {
  const row = await loadOwnedAgentMemory(ctx, agentId, memoryId);
  if (row.memoryType === "WORKSPACE") throwWorkspaceUnavailable();

  if (row.memoryType === "USER") {
    if (row.userId !== ctx.user.id) {
      throw new AgentServiceError("NOT_FOUND", "Memory entry not found", 404);
    }
    assertAgentPermission(ctx, "edit");
  } else {
    assertAgentPermission(ctx, row.memoryType === "AGENT" ? "edit" : "edit");
  }

  const agent = await loadOwnedAgent(ctx, agentId);
  assertAgentNotArchived(agent.status);

  const db = getAgentDb();
  await db.agentMemory.delete({ where: { id: row.id } });
}

/**
 * Clears memory entries the caller is allowed to clear:
 * - Admin: all non-WORKSPACE entries for the agent (USER of others included for admin clear)
 * - Non-admin: not permitted (admin-only)
 * WORKSPACE rows are left untouched (fail-closed / deferred).
 */
export async function clearAgentMemory(ctx: AgentContext, agentId: string): Promise<{ count: number }> {
  assertAgentPermission(ctx, "admin");
  const agent = await loadOwnedAgent(ctx, agentId);
  assertAgentNotArchived(agent.status);

  const db = getAgentDb();
  const rows = (await db.agentMemory.findMany({
    where: { organizationId: ctx.organizationId, agentId },
  })) as Array<Record<string, unknown>>;

  let count = 0;
  for (const row of rows) {
    const record = toPhase2Record(row);
    if (record.memoryType === "WORKSPACE") continue;
    await db.agentMemory.delete({ where: { id: record.id } });
    count += 1;
  }
  return { count };
}

/**
 * Bounded, read-only loader for agent-runner injection.
 * - memoryEnabled + allowRead required
 * - USER: only current user
 * - AGENT + EXECUTION_SUMMARY: org+agent
 * - WORKSPACE: never injected
 * - Expired: excluded
 */
export async function loadRecentMemoryForExecution(
  ctx: AgentContext,
  agentId: string,
  limit: number = RECENT_MEMORY_INJECTION_LIMIT,
): Promise<AgentMemoryPhase2Record[]> {
  const policy = await getAgentMemoryPolicySafe(ctx, agentId);
  if (!policy.memoryEnabled || !policy.allowRead) return [];
  try {
    const agent = await loadOwnedAgent(ctx, agentId);
    if (agent.status === "ARCHIVED" || agent.status === "DEPRECATED") return [];

    const db = getAgentDb();
    const rows = (await db.agentMemory.findMany({
      where: { organizationId: ctx.organizationId, agentId },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit, RECENT_MEMORY_INJECTION_LIMIT) * 4,
    })) as Array<Record<string, unknown>>;

    const active = rows
      .map(toPhase2Record)
      .filter((r) => {
        if (isExpired(r)) return false;
        if (r.memoryType === "WORKSPACE") return false;
        if (r.memoryType === "USER") return r.userId === ctx.user.id;
        if (r.memoryType === "AGENT" || r.memoryType === "EXECUTION_SUMMARY") return true;
        return false;
      })
      .map((r) => ({
        ...r,
        value: r.value ? sanitizeMemoryContentForInjection(r.value) : r.value,
        valuePreview: sanitizeMemoryContentForInjection(r.valuePreview),
      }))
      .filter((r) => (r.value ?? r.valuePreview)?.trim());

    return active.slice(0, limit);
  } catch {
    return [];
  }
}

/** Redacts secret-like spans for auto-summary persistence. */
export function redactSecretsInText(value: string): string {
  let out = value;
  for (const re of PHASE2_SECRET_PATTERNS) {
    out = out.replace(re, "[redacted]");
  }
  if (looksLikeSecret(out)) {
    out = "[redacted: secret-like content]";
  }
  return out;
}
