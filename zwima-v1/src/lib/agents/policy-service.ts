import { randomUUID } from "crypto";
import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { getAgentDb, type AgentOrgPolicyRecord } from "./types";

export async function listAgentOrgPolicies(ctx: AgentContext): Promise<AgentOrgPolicyRecord[]> {
  assertAgentPermission(ctx, "admin");
  const db = getAgentDb();
  return db.agentOrgPolicy.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { key: "asc" },
  });
}

export async function upsertAgentOrgPolicy(
  ctx: AgentContext,
  input: { key: string; value: Record<string, unknown> },
): Promise<AgentOrgPolicyRecord> {
  assertAgentPermission(ctx, "admin");
  const key = String(input.key || "").trim();
  if (!key) throw new AgentServiceError("VALIDATION_ERROR", "key is required", 400);

  const db = getAgentDb();
  const existing = await db.agentOrgPolicy.findFirst({
    where: { organizationId: ctx.organizationId, key },
  });

  if (existing) {
    return db.agentOrgPolicy.update({
      where: { id: existing.id },
      data: {
        value: input.value ?? {},
        version: existing.version + 1,
        updatedBy: ctx.user.id,
      },
    });
  }

  return db.agentOrgPolicy.create({
    data: {
      policyId: `pol_${randomUUID()}`,
      organizationId: ctx.organizationId,
      key,
      value: input.value ?? {},
      version: 1,
      updatedBy: ctx.user.id,
    },
  });
}
