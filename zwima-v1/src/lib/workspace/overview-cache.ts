type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (ttlMs <= 0) return;
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDeletePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Test helper — clears all overview caches. */
export function cacheClearAll(): void {
  store.clear();
}

export const OverviewCacheTtl = {
  identityMs: 60_000,
  organizationMs: 60_000,
  apiKeysMs: 30_000,
  projectsMs: 30_000,
  monthUsageMs: 12_000,
  todayUsageMs: 8_000,
  creditsMs: 5_000,
  /** Assembled first-screen payload — short to keep credits fresh. */
  slimPayloadMs: 5_000,
} as const;

export function overviewIdentityKey(clerkId: string) {
  return `ov:identity:${clerkId}`;
}

export function overviewOrgKey(organizationId: string) {
  return `ov:org:${organizationId}`;
}

export function overviewApiKeysKey(organizationId: string) {
  return `ov:apikeys:${organizationId}`;
}

export function overviewProjectsKey(organizationId: string) {
  return `ov:projects:${organizationId}`;
}

export function overviewMonthKey(organizationId: string, monthStartIso: string) {
  return `ov:month:${organizationId}:${monthStartIso}`;
}

export function overviewTodayKey(organizationId: string, todayIso: string) {
  return `ov:today:${organizationId}:${todayIso}`;
}

export function overviewCreditsKey(userId: string) {
  return `ov:credits:${userId}`;
}

export function overviewSlimKey(organizationId: string, userId: string) {
  return `ov:slim:${organizationId}:${userId}`;
}
