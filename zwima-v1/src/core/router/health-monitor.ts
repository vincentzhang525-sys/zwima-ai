import { getCachedHealthMetrics, type HealthMetrics } from "@/core/health";
import type { ProviderId } from "@/core/providers/types";

export function getProviderHealthScore(provider: ProviderId): number {
  const metrics = getCachedHealthMetrics()?.find((m) => m.provider === provider);
  if (!metrics) return 50;
  if (!metrics.online) return 0;
  const latencyPenalty = metrics.latencyMs ? Math.min(40, Math.floor(metrics.latencyMs / 100)) : 0;
  const availabilityBonus = Math.floor(metrics.availability * 40);
  const errorPenalty = Math.floor(metrics.errorRate * 50);
  return Math.max(0, 50 + availabilityBonus - latencyPenalty - errorPenalty);
}

export function isProviderHealthy(provider: ProviderId): boolean {
  const metrics = getCachedHealthMetrics()?.find((m) => m.provider === provider);
  if (!metrics) return true;
  return metrics.online && metrics.errorRate < 0.5;
}

export function snapshotHealth(provider: ProviderId): HealthMetrics | null {
  return getCachedHealthMetrics()?.find((m) => m.provider === provider) ?? null;
}
