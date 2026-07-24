import { pricingCache } from "@/core/cache";
import { listUnifiedAdapters } from "@/core/adapters";
import type { ModelPricingQuote, TokenCostInput, TokenCostResult } from "./types";

export function calculateTokenCost(input: TokenCostInput): TokenCostResult {
  const quotes = loadPricingQuotes();
  const quote = quotes.find((q) => q.provider === input.provider && q.model === input.model);
  const inputRate = quote?.inputCostPer1M ?? 1;
  const outputRate = quote?.outputCostPer1M ?? 2;
  const inputCostUsd = (input.inputTokens / 1_000_000) * inputRate;
  const outputCostUsd = (input.outputTokens / 1_000_000) * outputRate;

  return {
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

export function loadPricingQuotes(): ModelPricingQuote[] {
  const cached = pricingCache.get("all");
  if (cached) return cached;

  const quotes = listUnifiedAdapters().flatMap((a) => a.pricing());
  pricingCache.set("all", quotes);
  return quotes;
}

export function refreshPricingCache(): ModelPricingQuote[] {
  pricingCache.delete("all");
  return loadPricingQuotes();
}
