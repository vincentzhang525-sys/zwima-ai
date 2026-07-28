/**
 * Closed Beta live-call budget / allowlist (GAP-001).
 * Applies only when live provider HTTP is otherwise allowed.
 * Fail-closed: unknown models, oversized max_tokens, non-OpenAI provider lock violations.
 */

export const CLOSED_BETA_LIVE_BUDGET_EXCEEDED = "CLOSED_BETA_LIVE_BUDGET_EXCEEDED" as const;

export class ClosedBetaLiveBudgetError extends Error {
  readonly code = CLOSED_BETA_LIVE_BUDGET_EXCEEDED;

  constructor(message: string) {
    super(message);
    this.name = "ClosedBetaLiveBudgetError";
  }
}

export type ClosedBetaLiveBudgetEnv = {
  CLOSED_BETA_PROVIDER_LOCK?: string;
  CLOSED_BETA_ALLOWED_MODELS?: string;
  CLOSED_BETA_MAX_OUTPUT_TOKENS?: string;
  [key: string]: string | undefined;
};

const DEFAULT_ALLOWED_MODELS = ["gpt-5-nano", "gpt-5-mini", "gpt-4o-mini"];
const DEFAULT_MAX_OUTPUT_TOKENS = 64;

export function parseAllowedModels(env: ClosedBetaLiveBudgetEnv = process.env): string[] {
  const raw = (env.CLOSED_BETA_ALLOWED_MODELS ?? "").trim();
  if (!raw) return [...DEFAULT_ALLOWED_MODELS];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function maxOutputTokensAllowed(env: ClosedBetaLiveBudgetEnv = process.env): number {
  const n = Number(env.CLOSED_BETA_MAX_OUTPUT_TOKENS ?? DEFAULT_MAX_OUTPUT_TOKENS);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(Math.floor(n), 256);
}

export function providerLock(env: ClosedBetaLiveBudgetEnv = process.env): string | null {
  const lock = (env.CLOSED_BETA_PROVIDER_LOCK ?? "openai").trim().toLowerCase();
  return lock || null;
}

export function assertClosedBetaLiveChatAllowed(params: {
  providerSlug: string;
  model: string;
  maxTokens?: number | null;
  env?: ClosedBetaLiveBudgetEnv;
}): void {
  const env = params.env ?? (process.env as ClosedBetaLiveBudgetEnv);
  const lock = providerLock(env);
  if (lock && params.providerSlug.toLowerCase() !== lock) {
    throw new ClosedBetaLiveBudgetError(
      `${CLOSED_BETA_LIVE_BUDGET_EXCEEDED}: provider lock requires ${lock}`,
    );
  }

  const allowed = parseAllowedModels(env);
  if (!allowed.includes(params.model)) {
    throw new ClosedBetaLiveBudgetError(
      `${CLOSED_BETA_LIVE_BUDGET_EXCEEDED}: model not in Closed Beta allowlist`,
    );
  }

  const cap = maxOutputTokensAllowed(env);
  const requested = params.maxTokens == null ? cap : Number(params.maxTokens);
  if (!Number.isFinite(requested) || requested <= 0 || requested > cap) {
    throw new ClosedBetaLiveBudgetError(
      `${CLOSED_BETA_LIVE_BUDGET_EXCEEDED}: maxTokens must be 1..${cap}`,
    );
  }
}

export function clampMaxTokensForClosedBeta(
  maxTokens: number | undefined | null,
  env: ClosedBetaLiveBudgetEnv = process.env,
): number {
  const cap = maxOutputTokensAllowed(env);
  if (maxTokens == null || !Number.isFinite(Number(maxTokens))) return Math.min(16, cap);
  return Math.min(Math.max(1, Math.floor(Number(maxTokens))), cap);
}
