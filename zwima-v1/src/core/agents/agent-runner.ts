/**
 * M8 Agent Platform Phase 1 — safety-hardened run orchestrator.
 *
 * Pipeline: validate input -> load agent/version config -> resolve
 * provider/model (fail-closed for anything non-mock) -> pre-flight cost
 * ceiling check -> create AgentRun -> execute via the existing mock
 * execution engine under a wall-clock timeout -> enforce step/tool-call
 * ceilings -> return run + steps.
 *
 * This module does not reimplement the execution engine — it wraps
 * `src/lib/agents/execution-engine.ts` (`createRun`/`executeRun`/`getRun`/
 * `listRunSteps`) with the Phase 1 safety rails described in the spec.
 */

import type { AgentContext } from "@/lib/agents/auth";
import { assertAgentPermission } from "@/lib/agents/auth";
import { AgentServiceError } from "@/lib/agents/errors";
import { createRun, executeRun, getRun, listRunSteps } from "@/lib/agents/execution-engine";
import { getAgentVersion } from "@/lib/agents/registry-service";
import { getAgentDb } from "@/lib/agents/types";
import { isLiveProviderHttpAllowed } from "@/lib/providers/live-provider-gate";
import { AGENT_RUN_TIMEOUT_MS, MAX_AGENT_STEPS, MAX_AGENT_TOOL_CALLS, clampOutputTokens } from "./agent-safety";
import { projectWorstCaseCost, assertWithinCostCeiling } from "./agent-cost-tracker";
import { validateRunInput, validateToolRequest } from "./agent-validator";
import type { AgentRun, AgentRunResult, AgentVersion, RunAgentInput } from "./agent-types";

// ---------------------------------------------------------------------------
// Pure, independently-testable guards
// ---------------------------------------------------------------------------

export function assertStepLimit(stepCount: number): void {
  if (stepCount > MAX_AGENT_STEPS) {
    throw new AgentServiceError(
      "STEP_LIMIT_EXCEEDED",
      `Agent run exceeded the maximum of ${MAX_AGENT_STEPS} steps (had ${stepCount})`,
      409,
    );
  }
}

export function assertToolCallLimit(toolCallCount: number): void {
  if (toolCallCount > MAX_AGENT_TOOL_CALLS) {
    throw new AgentServiceError(
      "TOOL_CALL_LIMIT_EXCEEDED",
      `Agent run exceeded the maximum of ${MAX_AGENT_TOOL_CALLS} tool calls (had ${toolCallCount})`,
      409,
    );
  }
}

/** Fail-closed provider resolution: anything other than "mock" requires the global live-provider HTTP gate to be open. Phase 1 has no live adapter wired, so this always resolves to "mock" in practice — it exists to make the fail-closed behavior explicit and testable. */
export function resolveProviderMode(
  provider: string | undefined | null,
  isLiveAllowed: () => boolean = isLiveProviderHttpAllowed,
): "mock" | "live" {
  const normalized = (provider ?? "mock").trim().toLowerCase();
  if (normalized === "mock" || normalized === "") return "mock";
  if (!isLiveAllowed()) {
    throw new AgentServiceError(
      "LIVE_PROVIDER_BLOCKED",
      `Live provider '${normalized}' is not enabled for this environment; Phase 1 only runs the mock provider`,
      403,
    );
  }
  return "live";
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Promise<void> | void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(async () => {
      try {
        await onTimeout();
      } finally {
        reject(new AgentServiceError("RUN_TIMEOUT", `Agent run exceeded the ${ms}ms timeout`, 504));
      }
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function markRunTimedOut(runId: string, reason: string): Promise<void> {
  const db = getAgentDb();
  const run = await db.agentRun.findUnique({ where: { runId } });
  if (!run) return;
  const terminal = ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"];
  if (terminal.includes(run.status)) return;
  await db.agentRun.update({
    where: { id: run.id },
    data: { status: "TIMED_OUT", errorMessage: reason, completedAt: new Date() },
  });
}

function countToolSteps(steps: Array<{ stepType: string }>): number {
  return steps.filter((s) => s.stepType === "TOOL").length;
}

function extractRequestedToolKey(input: Record<string, unknown>): string | undefined {
  const useTool = input.useTool as { toolKey?: string } | undefined;
  return useTool?.toolKey;
}

/**
 * Runs an agent end-to-end (create + execute) with Phase 1 safety rails.
 * Preview/non-live environments always use the deterministic mock provider
 * via the existing execution engine; a non-"mock" version.provider is
 * fail-closed unless `isLiveProviderHttpAllowed()` is true (never true in
 * Preview by construction of that gate).
 */
export async function runAgentSafely(ctx: AgentContext, agentId: string, input: RunAgentInput): Promise<AgentRunResult> {
  assertAgentPermission(ctx, "edit");

  const validated = validateRunInput(input.input);
  const requestedToolKey = extractRequestedToolKey(validated.raw);
  validateToolRequest(requestedToolKey);

  const db = getAgentDb();
  const agent = await db.agentDefinition.findUnique({ where: { agentId } });
  if (!agent || agent.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Agent not found", 404);
  }
  if (!agent.currentVersionId) {
    throw new AgentServiceError("CONFLICT", "Agent has no version to run", 409);
  }
  let version: AgentVersion;
  try {
    version = await getAgentVersion(ctx, agent.currentVersionId);
  } catch {
    throw new AgentServiceError("CONFLICT", "Agent's current version could not be resolved", 409);
  }

  resolveProviderMode(version.provider);

  const maxTokens = clampOutputTokens(version.maxTokens);
  const projectedCost = projectWorstCaseCost(validated.text.length / 4, maxTokens);
  assertWithinCostCeiling(projectedCost, `Run of agent ${agentId}`);

  let run: AgentRun = await createRun(ctx, {
    agentId,
    input: validated.raw,
    workspaceId: input.workspaceId,
    idempotencyKey: input.idempotencyKey,
    parentRunId: input.parentRunId,
  });

  const shouldExecute = input.execute !== false;
  if (shouldExecute && run.status !== "COMPLETED") {
    run = await withTimeout(
      executeRun(ctx, run.runId),
      AGENT_RUN_TIMEOUT_MS,
      () => markRunTimedOut(run.runId, `Run exceeded ${AGENT_RUN_TIMEOUT_MS}ms timeout`),
    );
  }

  const steps = await listRunSteps(ctx, run.runId);
  assertStepLimit(steps.length);
  assertToolCallLimit(countToolSteps(steps));

  if (run.costEstimate != null) {
    assertWithinCostCeiling(run.costEstimate, `Completed run ${run.runId}`);
  }

  return { run, steps };
}

export async function getAgentRunWithSteps(ctx: AgentContext, runId: string): Promise<AgentRunResult> {
  const run = await getRun(ctx, runId);
  const steps = await listRunSteps(ctx, runId);
  return { run, steps };
}
