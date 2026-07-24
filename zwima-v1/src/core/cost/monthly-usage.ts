import type { MonthlyUsageRecord } from "./types";

const usageStore = new Map<string, MonthlyUsageRecord>();

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function storeKey(organizationId: string, key = monthKey()): string {
  return `${organizationId}:${key}`;
}

export function recordMonthlyUsage(params: {
  organizationId: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}): MonthlyUsageRecord {
  const key = storeKey(params.organizationId);
  const existing = usageStore.get(key) ?? {
    organizationId: params.organizationId,
    monthKey: monthKey(),
    inputTokens: 0,
    outputTokens: 0,
    totalCostUsd: 0,
    requestCount: 0,
  };

  existing.inputTokens += params.inputTokens;
  existing.outputTokens += params.outputTokens;
  existing.totalCostUsd += params.totalCostUsd;
  existing.requestCount += 1;
  usageStore.set(key, existing);
  return existing;
}

export function getMonthlyUsage(organizationId: string, key = monthKey()): MonthlyUsageRecord {
  return (
    usageStore.get(storeKey(organizationId, key)) ?? {
      organizationId,
      monthKey: key,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 0,
      requestCount: 0,
    }
  );
}

export function clearMonthlyUsage(): void {
  usageStore.clear();
}
