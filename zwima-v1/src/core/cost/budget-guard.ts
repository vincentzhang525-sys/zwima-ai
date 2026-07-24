import { getMonthlyUsage } from "./monthly-usage";
import type { BudgetGuardResult } from "./types";

export function checkBudgetGuard(params: {
  organizationId: string;
  monthlyBudgetUsd: number | null;
  projectedCostUsd: number;
}): BudgetGuardResult {
  if (params.monthlyBudgetUsd === null) {
    return { allowed: true, reason: null, remainingBudgetUsd: null };
  }

  const usage = getMonthlyUsage(params.organizationId);
  const projected = usage.totalCostUsd + params.projectedCostUsd;
  const remaining = params.monthlyBudgetUsd - usage.totalCostUsd;

  if (projected > params.monthlyBudgetUsd) {
    return {
      allowed: false,
      reason: "Monthly budget exceeded",
      remainingBudgetUsd: Math.max(0, remaining),
    };
  }

  return {
    allowed: true,
    reason: null,
    remainingBudgetUsd: Math.max(0, params.monthlyBudgetUsd - projected),
  };
}
