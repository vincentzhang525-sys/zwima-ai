import { getAdapter } from "../providers/registry";
import { recordProviderError, recordProviderSuccess } from "../providers/router";
import type { ChatMessage, ChatResult } from "../providers/types";
import type { ProviderCandidate, SmartRoutingDecision } from "./routing-types";

export type SmartFailoverResult = {
  result: ChatResult;
  decision: SmartRoutingDecision;
  fallbackCount: number;
  attemptedProviders: string[];
};

export async function executeSmartFailover(params: {
  decision: SmartRoutingDecision;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  allowFallback?: boolean;
  maxAttempts?: number;
  organizationId?: string | null;
  apiKeyId?: string;
  userId?: string | null;
  streamingStarted?: boolean;
}): Promise<SmartFailoverResult> {
  const allowFallback = params.allowFallback ?? params.decision.policySnapshot.allowFallback;
  const maxAttempts = params.maxAttempts ?? params.decision.policySnapshot.maxFallbackAttempts;

  const ordered = [
    params.decision.candidates.find(
      (c) => c.providerSlug === params.decision.selectedProviderSlug && !c.excluded,
    ),
    ...params.decision.candidates
      .filter((c) => !c.excluded && c.providerSlug !== params.decision.selectedProviderSlug)
      .sort((a, b) => b.totalScore - a.totalScore),
  ].filter(Boolean) as ProviderCandidate[];

  const attempted: string[] = [];
  let fallbackCount = 0;
  let lastError: Error | null = null;
  const toTry = allowFallback ? ordered.slice(0, maxAttempts + 1) : ordered.slice(0, 1);

  for (const candidate of toTry) {
    if (attempted.includes(candidate.providerSlug)) continue;
    const adapter = getAdapter(candidate.providerSlug);
    if (!adapter) {
      lastError = new Error(`Adapter not found: ${candidate.providerSlug}`);
      continue;
    }

    attempted.push(candidate.providerSlug);
    try {
      const result = await adapter.chat({
        model: candidate.modelId,
        messages: params.messages,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
      });
      recordProviderSuccess(candidate.providerSlug, result.latencyMs);

      if (fallbackCount > 0) {
        await logFailoverAudit({
          requestId: params.decision.requestId,
          fromProvider: params.decision.selectedProviderSlug,
          toProvider: candidate.providerSlug,
          errorType: lastError?.message ?? "provider_error",
          organizationId: params.organizationId,
          apiKeyId: params.apiKeyId,
          userId: params.userId,
        });
      }

      return {
        result,
        decision: {
          ...params.decision,
          selectedProviderId: candidate.providerId,
          selectedProviderName: candidate.providerName,
          selectedProviderSlug: candidate.providerSlug,
          selectedModelId: candidate.modelId,
          selectedModelName: candidate.modelName,
          selectedProviderModelId: candidate.providerModelId,
          estimatedCostEur: candidate.estimatedRequestCostEur,
          estimatedCustomerChargeCredits: candidate.estimatedCustomerChargeCredits,
          fallbackChain: attempted,
        },
        fallbackCount,
        attemptedProviders: attempted,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Provider failed");
      if (!isFallbackAllowedError(lastError)) {
        throw lastError;
      }
      if (params.streamingStarted) {
        throw new Error("Streaming response already started — fallback not allowed");
      }
      recordProviderError(candidate.providerSlug, lastError.message);
      fallbackCount++;
    }
  }

  throw lastError ?? new Error("All providers failed");
}

export function isFallbackAllowedError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  if (msg.includes("invalid") && msg.includes("input")) return false;
  if (msg.includes("authentication") || msg.includes("unauthorized") || msg.includes("401")) return false;
  if (msg.includes("insufficient credits") || msg.includes("402")) return false;
  if (msg.includes("compliance") || msg.includes("content policy")) return false;
  if (msg.includes("429") || msg.includes("rate limit")) return true;
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset")) return true;
  return msg.includes("provider failed") || msg.includes("unavailable");
}

export async function logFailoverAudit(params: {
  requestId: string;
  fromProvider: string;
  toProvider: string;
  errorType: string;
  organizationId?: string | null;
  apiKeyId?: string;
  userId?: string | null;
}) {
  const { prisma } = await import("../prisma");
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? undefined,
      action: "routing_failover",
      category: "AI_REQUEST",
      detail: {
        requestId: params.requestId,
        fromProvider: params.fromProvider,
        toProvider: params.toProvider,
        errorType: params.errorType,
        organizationId: params.organizationId,
        apiKeyId: params.apiKeyId,
      },
    },
  });
}
