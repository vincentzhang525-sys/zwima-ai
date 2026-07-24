import type { ProviderId, ProviderHealthSnapshot } from "@/core/providers/types";
import { healthCache } from "@/core/cache";
import { listUnifiedAdapters } from "@/core/adapters";
import type { AdapterHealthResult } from "@/core/adapters/types";

export type HealthMetrics = {
  provider: ProviderId;
  online: boolean;
  latencyMs: number | null;
  errorRate: number;
  availability: number;
  rateLimitRemaining: number | null;
  lastCheckedAt: string;
  message: string | null;
};

const metricsStore = new Map<ProviderId, { successes: number; failures: number; rateLimitRemaining: number | null }>();

function getMetrics(provider: ProviderId) {
  return metricsStore.get(provider) ?? { successes: 0, failures: 0, rateLimitRemaining: null };
}

export function recordSuccess(provider: ProviderId, latencyMs: number): void {
  const m = getMetrics(provider);
  m.successes += 1;
  metricsStore.set(provider, m);
}

export function recordFailure(provider: ProviderId): void {
  const m = getMetrics(provider);
  m.failures += 1;
  metricsStore.set(provider, m);
}

export function recordRateLimit(provider: ProviderId, remaining: number | null): void {
  const m = getMetrics(provider);
  m.rateLimitRemaining = remaining;
  metricsStore.set(provider, m);
}

export function toHealthMetrics(provider: ProviderId, health: AdapterHealthResult): HealthMetrics {
  const m = getMetrics(provider);
  const total = m.successes + m.failures;
  const errorRate = total > 0 ? m.failures / total : 0;
  const availability = total > 0 ? m.successes / total : health.online ? 1 : 0;

  return {
    provider,
    online: health.online,
    latencyMs: health.latencyMs,
    errorRate,
    availability,
    rateLimitRemaining: m.rateLimitRemaining,
    lastCheckedAt: new Date().toISOString(),
    message: health.error,
  };
}

export async function runHealthChecks(): Promise<HealthMetrics[]> {
  const adapters = listUnifiedAdapters();
  const results: HealthMetrics[] = [];

  for (const adapter of adapters) {
    try {
      const health = await adapter.health();
      if (health.online) recordSuccess(adapter.id, health.latencyMs ?? 0);
      else recordFailure(adapter.id);
      results.push(toHealthMetrics(adapter.id, health));
    } catch {
      recordFailure(adapter.id);
      results.push(toHealthMetrics(adapter.id, {
        provider: adapter.id,
        online: false,
        latencyMs: null,
        error: "health check failed",
        configured: false,
      }));
    }
  }

  healthCache.set("all", results as unknown as ProviderHealthSnapshot[]);
  return results;
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export function startHealthAutoRefresh(intervalMs = Number(process.env.CORE_HEALTH_REFRESH_MS ?? 30_000)): void {
  stopHealthAutoRefresh();
  void runHealthChecks();
  refreshTimer = setInterval(() => {
    void runHealthChecks();
  }, intervalMs);
}

export function stopHealthAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export function clearHealthEngineState(): void {
  metricsStore.clear();
  stopHealthAutoRefresh();
}

export function getCachedHealthMetrics(): HealthMetrics[] | undefined {
  return healthCache.get("all") as unknown as HealthMetrics[] | undefined;
}
