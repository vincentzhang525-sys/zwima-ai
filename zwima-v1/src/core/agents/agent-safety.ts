/**
 * M8 Agent Platform Phase 1 — safety limits.
 *
 * These are hard ceilings enforced by `agent-runner.ts` on top of the
 * existing `src/lib/agents/execution-engine.ts`. They exist independently of
 * any per-organization `AgentOrgPolicy` overrides (which may only tighten,
 * never loosen, these values in a later phase).
 */

/** Maximum number of AgentRunStep rows a single run may accumulate (PLAN/MODEL/TOOL/REVIEW/...). */
export const MAX_AGENT_STEPS = 8;

/** Maximum number of tool invocations a single run may perform. */
export const MAX_AGENT_TOOL_CALLS = 5;

/** Wall-clock budget for a single `runAgent` call before it is force-failed as TIMED_OUT. */
export const AGENT_RUN_TIMEOUT_MS = 60_000;

/** Maximum size (characters) of user-supplied run input accepted before validation rejects it. */
export const MAX_AGENT_INPUT_CHARS = 20_000;

/** Hard ceiling on `maxTokens` regardless of what the agent version config requests. */
export const MAX_OUTPUT_TOKENS_CLAMP = 4096;

/** Per-run synthetic cost ceiling (USD). The mock provider's cost is always far below this; it exists to prove the guard works and to bound any future live-cost path. */
export const PER_RUN_COST_CEILING_USD = 5.0;

export function clampOutputTokens(value: number | undefined | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return MAX_OUTPUT_TOKENS_CLAMP;
  return Math.min(MAX_OUTPUT_TOKENS_CLAMP, Math.floor(n));
}

// ---------------------------------------------------------------------------
// Tool allowlist — Phase 1 frozen exact set (no extras, no env/fallback enable)
// ---------------------------------------------------------------------------

/**
 * Phase 1 executable tool allowlist — exact frozen set.
 * Must NOT include Phase 2 reserved mock keys (web-search-mock, etc.).
 */
export const ALLOWED_TOOL_KEYS = Object.freeze([
  "calculator",
  "current_datetime",
  "workspace_usage_summary",
] as const);

/** Alias kept for callers that previously imported CORE_TOOL_KEYS. */
export const CORE_TOOL_KEYS = ALLOWED_TOOL_KEYS;
export type CoreToolKey = (typeof ALLOWED_TOOL_KEYS)[number];
export type AllowedToolKey = CoreToolKey;

/** Tool names that must NEVER be allowlisted — defense in depth. */
export const FORBIDDEN_TOOL_KEYS: readonly string[] = [
  "shell",
  "exec",
  "http_request",
  "fetch_url",
  "http",
  "arbitrary-http",
  "filesystem_write",
  "filesystem-write",
  "write_file",
  "fs_write",
  "raw_sql",
  "raw-sql",
  "sql",
  "execute_sql",
  "send_email",
  "email_send",
  "email-send",
  "payment",
  "charge_card",
  "create_payment",
  "stripe_charge",
  // Phase 2 reserved — source may exist, but must not be Phase 1 executable
  "web-search-mock",
  "document-retrieval-mock",
  "email-draft-mock",
];

export function isAllowedToolKey(key: string): key is AllowedToolKey {
  if (!key) return false;
  if (FORBIDDEN_TOOL_KEYS.includes(key)) return false;
  return (ALLOWED_TOOL_KEYS as readonly string[]).includes(key);
}
