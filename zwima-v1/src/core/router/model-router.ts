import { randomUUID } from "crypto";
import { checkBudgetGuard } from "@/core/cost";
import { estimateRequestCost } from "@/core/cost/estimator";
import { buildRoutingCandidates, selectBestCandidate } from "./provider-selector";
import type { RoutingDecision, RoutingRequest } from "./types";

export class RoutingError extends Error {
  readonly code = "ROUTING_FAILED" as const;
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "RoutingError";
  }
}

export function resolveRoutingDecision(
  request: RoutingRequest,
  requestId: string = randomUUID(),
): RoutingDecision {
  const candidates = buildRoutingCandidates(request);
  const selected = selectBestCandidate(candidates);

  if (!selected) {
    throw new RoutingError(
      request.model
        ? `No provider available for model ${request.model}`
        : "No routing candidates available for request",
    );
  }

  if (request.organizationId && request.monthlyBudgetUsd !== undefined) {
    const projected = estimateRequestCost({
      provider: selected.provider,
      model: selected.model,
      inputTokens: 500,
      outputTokens: 500,
    });
    const guard = checkBudgetGuard({
      organizationId: request.organizationId,
      monthlyBudgetUsd: request.monthlyBudgetUsd ?? null,
      projectedCostUsd: projected.totalCostUsd,
    });
    if (!guard.allowed) {
      throw new RoutingError(guard.reason ?? "Budget exceeded");
    }
  }

  const fallbackChain = candidates.filter(
    (c) => !(c.provider === selected.provider && c.model === selected.model),
  );

  return {
    requestId,
    selected,
    fallbackChain,
    rejectedCount: Math.max(0, candidates.length - 1 - fallbackChain.length),
  };
}

export function buildExecutionChain(decision: RoutingDecision): import("./types").RoutingCandidate[] {
  return [decision.selected, ...decision.fallbackChain];
}
