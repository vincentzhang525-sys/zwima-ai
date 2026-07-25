import { hashText } from "../compliance/hashes";
import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { getAgentDb, newAgentMemoryId, type AgentMemoryRecord, type AgentMemoryScope } from "./types";

export type CreateAgentMemoryInput = {
  agentId: string;
  runId?: string | null;
  scope: AgentMemoryScope;
  key: string;
  /** Raw value — hashed immediately below and NEVER persisted as plaintext. */
  value: string;
  metadata?: Record<string, unknown> | null;
  ttlSeconds?: number;
};

/**
 * Defense-in-depth guard: refuse to accept content that looks like a raw
 * credential/secret, even though we never persist raw values anyway. Catches
 * accidental secret-in-memory calls at the API boundary.
 */
const SECRET_LIKE_PATTERN =
  /(sk-[a-zA-Z0-9]{10,}|api[_-]?key\s*[:=]|bearer\s+[a-zA-Z0-9._-]{10,}|password\s*[:=]|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;

export function looksLikeSecret(value: string): boolean {
  return SECRET_LIKE_PATTERN.test(value);
}

/** Produces a short, non-reversible-looking preview — never long enough to reconstruct the original value. */
export function redactValuePreview(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)} (${trimmed.length} chars)`;
}

async function assertAgentInOrg(ctx: AgentContext, agentId: string) {
  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
  }
}

export async function createAgentMemory(
  ctx: AgentContext,
  input: CreateAgentMemoryInput,
): Promise<AgentMemoryRecord> {
  assertAgentPermission(ctx, input.scope === "WORKSPACE" ? "admin" : "edit");
  const key = String(input.key || "").trim();
  const value = String(input.value ?? "");
  if (!key) throw new AgentServiceError("VALIDATION_ERROR", "key is required", 400);
  if (!value) throw new AgentServiceError("VALIDATION_ERROR", "value is required", 400);
  if (looksLikeSecret(value)) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      "Refusing to store secret-like content (API key/password/token/private key) in agent memory",
      400,
    );
  }
  await assertAgentInOrg(ctx, input.agentId);

  const db = getAgentDb();
  const expiresAt = input.ttlSeconds ? new Date(Date.now() + input.ttlSeconds * 1000) : null;

  return db.agentMemory.create({
    data: {
      memoryId: newAgentMemoryId(),
      organizationId: ctx.organizationId,
      workspaceId: input.scope === "WORKSPACE" ? ctx.organizationId : null,
      agentId: input.agentId,
      runId: input.runId ?? null,
      scope: input.scope,
      key,
      valueHash: hashText(value),
      valuePreview: redactValuePreview(value),
      metadata: input.metadata ?? null,
      expiresAt,
      createdBy: ctx.user.id,
    },
  });
}

export async function listAgentMemory(
  ctx: AgentContext,
  params: { agentId?: string; runId?: string | null; scope?: AgentMemoryScope; limit?: number } = {},
): Promise<AgentMemoryRecord[]> {
  assertAgentPermission(ctx, "read");
  if (params.agentId) await assertAgentInOrg(ctx, params.agentId);
  const db = getAgentDb();
  return db.agentMemory.findMany({
    where: {
      organizationId: ctx.organizationId,
      agentId: params.agentId,
      runId: params.runId ?? undefined,
      scope: params.scope,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 100, 500),
  });
}

export async function getAgentMemory(ctx: AgentContext, memoryId: string): Promise<AgentMemoryRecord> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  const memory = await db.agentMemory.findUnique({ where: { memoryId } });
  if (!memory || memory.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Memory entry not found", 404);
  }
  return memory;
}

export async function deleteAgentMemory(ctx: AgentContext, memoryId: string): Promise<void> {
  const memory = await getAgentMemory(ctx, memoryId);
  assertAgentPermission(ctx, memory.scope === "WORKSPACE" ? "admin" : "edit");
  const db = getAgentDb();
  await db.agentMemory.delete({ where: { id: memory.id } });
}

/** Deletes all expired memory rows for the caller's org. Safe to run on a schedule; scoped by organizationId. */
export async function purgeExpiredAgentMemory(ctx: AgentContext): Promise<{ count: number }> {
  assertAgentPermission(ctx, "admin");
  const db = getAgentDb();
  return db.agentMemory.deleteMany({
    where: { organizationId: ctx.organizationId, expiresAt: { lt: new Date() } },
  });
}
