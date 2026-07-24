import type { ProviderId } from "@/core/providers/types";

export type ModelPricingQuote = {
  provider: ProviderId;
  model: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  currency: "USD";
};

export type TokenCostInput = {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type TokenCostResult = {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
};

export type MonthlyUsageRecord = {
  organizationId: string;
  monthKey: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  requestCount: number;
};

export type BudgetGuardResult = {
  allowed: boolean;
  reason: string | null;
  remainingBudgetUsd: number | null;
};
