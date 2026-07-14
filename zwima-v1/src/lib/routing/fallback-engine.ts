import { getAdapter } from "../providers/registry";
import { recordProviderError, recordProviderSuccess } from "../providers/router";
import type { ChatMessage, ChatResult } from "../providers/types";
import type { RoutingCandidate, RoutingDecision } from "./routing-types";
import { getPlatformEnv } from "../env";

export type FallbackResult = {
  result: ChatResult;
  decision: RoutingDecision;
  chargedOnce: true;
};

export async function executeWithFallback(params: {
  decision: RoutingDecision;
  candidates: RoutingCandidate[];
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  fallbackEnabled?: boolean;
  maxRetries?: number;
}): Promise<FallbackResult> {
  const env = getPlatformEnv();
  const maxRetries = params.maxRetries ?? env.maxProviderRetries;
  const fallbackEnabled = params.fallbackEnabled ?? true;

  const ordered = [
    params.decision.selected,
    ...params.candidates
      .filter((c) => !c.excluded && c.providerSlug !== params.decision.selected.providerSlug)
      .sort((a, b) => (b.scores?.total ?? 0) - (a.scores?.total ?? 0)),
  ];

  const attempted: string[] = [];
  let fallbackCount = 0;
  let lastError: Error | null = null;

  const toTry = fallbackEnabled ? ordered.slice(0, maxRetries + 1) : [ordered[0]];

  for (const candidate of toTry) {
    if (!candidate) continue;
    const adapter = getAdapter(candidate.providerSlug);
    if (!adapter) continue;

    attempted.push(candidate.providerSlug);
    try {
      const result = await adapter.chat({
        model: candidate.modelCode,
        messages: params.messages,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
      });
      recordProviderSuccess(candidate.providerSlug, result.latencyMs);

      return {
        result,
        decision: {
          ...params.decision,
          selected: candidate,
          fallbackCount,
          attemptedProviders: attempted,
          routingReason:
            fallbackCount > 0
              ? `${params.decision.routingReason}; fallback ${fallbackCount} to ${candidate.providerSlug}`
              : params.decision.routingReason,
        },
        chargedOnce: true,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Provider failed");
      recordProviderError(candidate.providerSlug, lastError.message);
      fallbackCount++;
    }
  }

  throw lastError ?? new Error("All providers failed");
}
