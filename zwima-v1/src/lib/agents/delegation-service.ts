import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { createRun } from "./execution-engine";
import { getAgentDb, newAgentDelegationId, type AgentDelegationRecord, type AgentRunRecord } from "./types";

export type DelegateRunInput = {
  parentRunId: string;
  childAgentId: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
};

async function loadOwnedRun(ctx: AgentContext, runId: string): Promise<AgentRunRecord> {
  const db = getAgentDb();
  const run = await db.agentRun.findUnique({ where: { runId } });
  if (!run || run.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent run not found", 404);
  }
  return run;
}

/** Walks parentRunId pointers up to `maxHops` and returns the chain of agentIds from root -> ... -> run (inclusive). */
export async function getDelegationAgentChain(runId: string, maxHops = 10): Promise<string[]> {
  const db = getAgentDb();
  const chain: string[] = [];
  let current = await db.agentRun.findUnique({ where: { runId } });
  let hops = 0;
  while (current && hops <= maxHops) {
    chain.unshift(current.agentId);
    if (!current.parentRunId) break;
    current = await db.agentRun.findUnique({ where: { runId: current.parentRunId } });
    hops += 1;
  }
  return chain;
}

/** Pure cycle check: would adding `candidateAgentId` as a delegation target re-visit an agent already in the chain? */
export function wouldCreateCycle(existingChainAgentIds: string[], candidateAgentId: string): boolean {
  return existingChainAgentIds.includes(candidateAgentId);
}

export async function listDelegationsForParentRun(
  ctx: AgentContext,
  parentRunId: string,
): Promise<AgentDelegationRecord[]> {
  assertAgentPermission(ctx, "read");
  await loadOwnedRun(ctx, parentRunId);
  const db = getAgentDb();
  return db.agentDelegation.findMany({ where: { parentRunId }, orderBy: { createdAt: "asc" } });
}

/**
 * Creates a child run delegated from `parentRunId` to `childAgentId`, enforcing:
 *  - cycle protection (an agent cannot delegate — directly or transitively — back to itself)
 *  - `maxDelegationChildren` (from the parent run's AgentVersion) on the number of children per parent run
 *  - `maxDelegationDepth` (enforced inside `createRun`, which already computes depth from the parent chain)
 */
export async function delegateRun(
  ctx: AgentContext,
  input: DelegateRunInput,
): Promise<{ delegation: AgentDelegationRecord; childRun: AgentRunRecord }> {
  assertAgentPermission(ctx, "edit");
  const db = getAgentDb();

  const parentRun = await loadOwnedRun(ctx, input.parentRunId);
  const parentVersion = await db.agentVersion.findUnique({ where: { versionId: parentRun.agentVersionId } });
  if (!parentVersion) {
    throw new AgentServiceError("NOT_FOUND", "Parent run's agent version no longer exists", 404);
  }

  const chain = await getDelegationAgentChain(parentRun.runId);
  if (wouldCreateCycle(chain, input.childAgentId)) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `Delegation would create a cycle: agent ${input.childAgentId} already appears in this run's delegation chain`,
      400,
    );
  }

  const existingChildrenCount = await db.agentDelegation.count({ where: { parentRunId: parentRun.runId } });
  if (existingChildrenCount >= parentVersion.maxDelegationChildren) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `Parent run already has ${existingChildrenCount} delegated children (max ${parentVersion.maxDelegationChildren})`,
      400,
    );
  }

  // createRun independently re-validates maxDelegationDepth against the *child* agent's own version.
  const childRun = await createRun(ctx, {
    agentId: input.childAgentId,
    input: input.input,
    workspaceId: parentRun.workspaceId,
    idempotencyKey: input.idempotencyKey,
    parentRunId: parentRun.runId,
  });

  const delegation = await db.agentDelegation.create({
    data: {
      delegationId: newAgentDelegationId(),
      parentRunId: parentRun.runId,
      childRunId: childRun.runId,
      parentAgentId: parentRun.agentId,
      childAgentId: input.childAgentId,
      organizationId: ctx.organizationId,
      depth: childRun.depth,
    },
  });

  return { delegation, childRun };
}
