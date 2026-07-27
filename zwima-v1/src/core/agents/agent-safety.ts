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

// ---------------------------------------------------------------------------
// M8 Agent Platform Phase 2A — template & memory ceilings
//
// These bound the new AgentTemplate / AgentMemoryPolicy surfaces. They are
// independent hard ceilings, not a relaxation of anything above: a template
// can never request a higher step/timeout/cost budget than Phase 1 already
// allows, and memory policy limits are bounded regardless of what an org
// requests.
// ---------------------------------------------------------------------------

/** Number of most-recent memory entries injected as read-only context into a run when memory is enabled. */
export const RECENT_MEMORY_INJECTION_LIMIT = 5;

/** Hard ceiling on a single memory entry's injected content (chars). */
export const MAX_MEMORY_INJECTION_ENTRY_CHARS = 500;

/** Hard ceiling on the total Memory Context block injected into a run (chars). */
export const MAX_MEMORY_CONTEXT_TOTAL_CHARS = 2_500;

/** Hard ceiling on `AgentMemoryPolicy.maxEntries`, regardless of what an org requests. */
export const MAX_MEMORY_POLICY_ENTRIES_CLAMP = 500;

/** Hard ceiling on `AgentMemoryPolicy.maxEntryCharacters`, regardless of what an org requests. */
export const MAX_MEMORY_POLICY_ENTRY_CHARS_CLAMP = 10_000;

/** Hard ceiling on `AgentMemoryPolicy.retentionDays`, regardless of what an org requests. */
export const MAX_MEMORY_POLICY_RETENTION_DAYS_CLAMP = 365;

/** Maximum number of custom (non-system) templates allowlisted tool keys — mirrors `RunAgentSchema`'s `toolIds` cap. */
export const MAX_TEMPLATE_TOOL_KEYS = 20;

/**
 * Common instruction-override / tool-abuse patterns filtered from memory
 * before injection. Layered defense only — not a complete prompt-injection cure.
 */
export const MEMORY_INJECTION_OVERRIDE_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /override\s+(the\s+)?system\s+prompt/gi,
  /disregard\s+(your\s+)?(rules|instructions|system\s+prompt)/gi,
  /reveal\s+(your\s+)?(secrets?|api\s*keys?|passwords?)/gi,
  /execute\s+(a\s+)?shell/gi,
  /run\s+(a\s+)?shell\s+command/gi,
  /send\s+(an?\s+)?emails?/gi,
  /create\s+(a\s+)?payment/gi,
  /charge\s+(a\s+)?(card|payment)/gi,
  /arbitrary\s+https?\s+request/gi,
  /fetch\s+https?:\/\//gi,
  /call\s+(the\s+)?(shell|http|payment|email)\s+tool/gi,
];
