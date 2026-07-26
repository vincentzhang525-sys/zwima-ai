/**
 * M8 Agent Platform Phase 1 — cost tracking / ceiling.
 *
 * Wraps the existing `estimateMockCost` from `src/lib/agents/mock-provider`
 * with a hard per-run ceiling check. This never touches the M4 real
 * billing/cost engine — it is a synthetic safety rail for the mock
 * execution path only.
 */

import { estimateMockCost } from "@/lib/agents/mock-provider";
import { AgentServiceError } from "@/lib/agents/errors";
import { MAX_OUTPUT_TOKENS_CLAMP, PER_RUN_COST_CEILING_USD } from "./agent-safety";

export type TokenUsage = { inputTokens: number; outputTokens: number };

export function estimateRunCost(usage: TokenUsage): number {
  return estimateMockCost(usage.inputTokens, usage.outputTokens);
}

/**
 * Worst-case cost projection for a run before it executes, using the
 * clamped max output tokens and the caller-supplied estimated input size.
 * Used as a pre-flight guard so a run is never even started if it could not
 * possibly stay under the ceiling.
 */
export function projectWorstCaseCost(estimatedInputTokens: number, maxTokens: number): number {
  const clampedOutput = Math.min(MAX_OUTPUT_TOKENS_CLAMP, Math.max(0, Math.floor(maxTokens)));
  return estimateMockCost(Math.max(0, Math.floor(estimatedInputTokens)), clampedOutput);
}

export function assertWithinCostCeiling(cost: number, context: string): void {
  if (cost > PER_RUN_COST_CEILING_USD) {
    throw new AgentServiceError(
      "COST_CEILING_EXCEEDED",
      `${context} would exceed the per-run cost ceiling of $${PER_RUN_COST_CEILING_USD.toFixed(2)} (projected $${cost.toFixed(6)})`,
      402,
    );
  }
}
