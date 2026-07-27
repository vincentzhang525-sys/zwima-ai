/**
 * M8 Phase 2B — in-process memory write rate limiter.
 *
 * Preview-only minimum protection. Not strongly consistent across multiple
 * serverless instances; Digital Infrastructure hardening is a follow-up.
 * No Redis, no new env vars.
 */

import { AgentServiceError } from "@/lib/agents/errors";

const WINDOW_MS = 60_000;
/** Max memory writes per org+agent+user within WINDOW_MS. */
export const MEMORY_WRITE_RATE_LIMIT = 20;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function memoryWriteRateLimitKey(organizationId: string, agentId: string, userId: string): string {
  return `memwrite:${organizationId}:${agentId}:${userId}`;
}

/** Test helper — clears all buckets between unit tests. */
export function resetMemoryWriteRateLimitForTests(): void {
  buckets.clear();
}

/**
 * Throws MEMORY_RATE_LIMITED (429) when the caller exceeds MEMORY_WRITE_RATE_LIMIT
 * writes in the current sliding minute window.
 */
export function assertMemoryWriteRateLimit(organizationId: string, agentId: string, userId: string): void {
  const key = memoryWriteRateLimitKey(organizationId, agentId, userId);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { count: 0, windowStart: now };
  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > MEMORY_WRITE_RATE_LIMIT) {
    throw new AgentServiceError(
      "MEMORY_RATE_LIMITED",
      `Memory write rate limit exceeded (${MEMORY_WRITE_RATE_LIMIT} per minute per agent/user)`,
      429,
      { limit: MEMORY_WRITE_RATE_LIMIT, windowMs: WINDOW_MS },
    );
  }
}
