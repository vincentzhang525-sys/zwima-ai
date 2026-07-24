import { calculateTokenCost } from "./calculator";
import type { TokenCostInput, TokenCostResult } from "./types";

export function estimateRequestCost(input: TokenCostInput): TokenCostResult {
  return calculateTokenCost(input);
}

export function estimateBatchCost(inputs: TokenCostInput[]): TokenCostResult & { breakdown: TokenCostResult[] } {
  const breakdown = inputs.map(calculateTokenCost);
  const total = breakdown.reduce(
    (acc, row) => ({
      provider: acc.provider,
      model: acc.model,
      inputTokens: acc.inputTokens + row.inputTokens,
      outputTokens: acc.outputTokens + row.outputTokens,
      inputCostUsd: acc.inputCostUsd + row.inputCostUsd,
      outputCostUsd: acc.outputCostUsd + row.outputCostUsd,
      totalCostUsd: acc.totalCostUsd + row.totalCostUsd,
    }),
    {
      provider: breakdown[0]?.provider ?? "openai",
      model: "batch",
      inputTokens: 0,
      outputTokens: 0,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
    },
  );
  return { ...total, breakdown };
}
