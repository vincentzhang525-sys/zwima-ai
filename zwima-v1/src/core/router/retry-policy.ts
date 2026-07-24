import type { RetryConfig } from "./types";

export const DEFAULT_RETRY_POLICY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
};

export function shouldRetry(attempt: number, config: RetryConfig = DEFAULT_RETRY_POLICY): boolean {
  return attempt < config.maxAttempts;
}

export function retryDelayMs(attempt: number, config: RetryConfig = DEFAULT_RETRY_POLICY): number {
  const delay = config.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_POLICY,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (!shouldRetry(attempt, config)) break;
      await sleep(retryDelayMs(attempt, config));
    }
  }
  throw lastError;
}
