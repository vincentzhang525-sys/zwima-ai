import type { HealthResult, RouteResult } from "./types";
import { getAllAdapters } from "./registry";

type ProviderRuntimeState = {
  lastHealth: HealthResult | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastCheckedAt: Date | null;
  usageToday: number;
};

const runtime = new Map<string, ProviderRuntimeState>();
const dayMarkers = new Map<string, string>();

function stateFor(slug: string): ProviderRuntimeState {
  if (!runtime.has(slug)) {
    runtime.set(slug, {
      lastHealth: null,
      lastError: null,
      lastLatencyMs: null,
      lastCheckedAt: null,
      usageToday: 0,
    });
  }
  return runtime.get(slug)!;
}

export function recordProviderSuccess(slug: string, latencyMs: number) {
  const s = stateFor(slug);
  s.lastError = null;
  s.lastLatencyMs = latencyMs;
  s.lastCheckedAt = new Date();
  s.usageToday += 1;
}

export function recordProviderError(slug: string, error: string, latencyMs?: number) {
  const s = stateFor(slug);
  s.lastError = error;
  s.lastLatencyMs = latencyMs ?? null;
  s.lastCheckedAt = new Date();
}

export function recordHealthCheck(slug: string, health: HealthResult) {
  const s = stateFor(slug);
  s.lastHealth = health;
  s.lastError = health.error;
  s.lastLatencyMs = health.latencyMs;
  s.lastCheckedAt = new Date();
}

export function getProviderRuntime(slug: string) {
  return stateFor(slug);
}

export function getAllProviderRuntime() {
  return getAllAdapters().map((adapter) => ({
    slug: adapter.slug,
    name: adapter.name,
    ...stateFor(adapter.slug),
  }));
}

/** Reset usageToday at midnight UTC — called lazily on read. */
export function refreshDailyCounters() {
  const today = new Date().toISOString().slice(0, 10);
  for (const [slug, s] of runtime) {
    const stored = dayMarkers.get(slug);
    if (stored !== today) {
      s.usageToday = 0;
      dayMarkers.set(slug, today);
    }
  }
}

export async function checkAllProvidersHealth(): Promise<Record<string, string>> {
  refreshDailyCounters();
  const result: Record<string, string> = {};
  await Promise.all(
    getAllAdapters().map(async (adapter) => {
      const health = await adapter.health();
      recordHealthCheck(adapter.slug, health);
      result[adapter.slug] =
        health.status === "ok" ? "ok" : health.status === "unconfigured" ? "unconfigured" : "error";
    })
  );
  return result;
}

export async function routeByModel(model: string): Promise<RouteResult | null> {
  const normalized = model.trim().toLowerCase();
  for (const adapter of getAllAdapters()) {
    const match = adapter.models().find((m) => m.id.toLowerCase() === normalized);
    if (match) return { adapter, model: match.id };
  }
  return null;
}

export { getAllAdapters, getAdapter } from "./registry";
