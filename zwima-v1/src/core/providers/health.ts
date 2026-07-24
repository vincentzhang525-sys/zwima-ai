import type { AIProvider } from "./provider";
import type {
  ProviderHealthSnapshot,
  ProviderId,
  ProviderOperationalStatus,
  ProviderRegistryEntry,
} from "./types";

type HealthRecord = {
  successes: number;
  failures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastLatencyMs: number | null;
  quotaRemaining: number | null;
};

const healthRecords = new Map<ProviderId, HealthRecord>();

function emptyRecord(): HealthRecord {
  return {
    successes: 0,
    failures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastLatencyMs: null,
    quotaRemaining: null,
  };
}

export function recordHealthSuccess(providerId: ProviderId, latencyMs: number, quotaRemaining?: number | null): void {
  const record = healthRecords.get(providerId) ?? emptyRecord();
  record.successes += 1;
  record.lastSuccessAt = new Date().toISOString();
  record.lastLatencyMs = latencyMs;
  if (quotaRemaining !== undefined) record.quotaRemaining = quotaRemaining;
  healthRecords.set(providerId, record);
}

export function recordHealthFailure(providerId: ProviderId, message?: string): void {
  const record = healthRecords.get(providerId) ?? emptyRecord();
  record.failures += 1;
  record.lastFailureAt = new Date().toISOString();
  healthRecords.set(providerId, record);
  void message;
}

export function getHealthRecord(providerId: ProviderId): HealthRecord {
  return healthRecords.get(providerId) ?? emptyRecord();
}

export function computeHealthSnapshot(
  providerId: ProviderId,
  configured: boolean,
  latencyMs: number | null,
  message: string | null = null,
): ProviderHealthSnapshot {
  const record = getHealthRecord(providerId);
  const total = record.successes + record.failures;
  const errorRate = total > 0 ? record.failures / total : 0;

  let status: ProviderOperationalStatus = "ONLINE";
  if (!configured) status = "UNCONFIGURED";
  else if (errorRate >= 0.5) status = "OFFLINE";
  else if (errorRate >= 0.2 || (latencyMs !== null && latencyMs > 5000)) status = "DEGRADED";

  return {
    online: status === "ONLINE" || status === "DEGRADED",
    latencyMs: latencyMs ?? record.lastLatencyMs,
    lastSuccessAt: record.lastSuccessAt,
    lastFailureAt: record.lastFailureAt,
    errorRate,
    quotaRemaining: record.quotaRemaining,
    status,
    message,
  };
}

export async function runProviderHealthCheck(provider: AIProvider): Promise<ProviderHealthSnapshot> {
  const start = Date.now();
  try {
    const snapshot = await provider.health();
    recordHealthSuccess(provider.id, snapshot.latencyMs ?? Date.now() - start, snapshot.quotaRemaining);
    return snapshot;
  } catch (err) {
    recordHealthFailure(provider.id, err instanceof Error ? err.message : "health check failed");
    return computeHealthSnapshot(provider.id, true, null, err instanceof Error ? err.message : "health check failed");
  }
}

export async function runAllProviderHealthChecks(providers: AIProvider[]): Promise<ProviderHealthSnapshot[]> {
  return Promise.all(providers.map((p) => runProviderHealthCheck(p)));
}

export function attachHealthToRegistryEntry(
  entry: ProviderRegistryEntry,
  snapshot: ProviderHealthSnapshot,
): ProviderRegistryEntry {
  return { ...entry, health: snapshot, status: snapshot.status };
}

export function clearHealthRecords(): void {
  healthRecords.clear();
}
