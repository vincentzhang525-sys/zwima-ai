/**
 * M8 Agent Platform Phase 1 — safety limits.
 *
 * These are hard ceilings enforced by `agent-runner.ts` on top of the
 * existing `src/lib/agents/execution-engine.ts`. They exist independently of
 * any per-organization `AgentOrgPolicy` overrides (which may only tighten,
 * never loosen, these values in a later phase).
 */

import { MOCK_TOOL_KEYS, type MockToolKey } from "@/lib/agents/mock-tools";

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
// Tool allowlist
// ---------------------------------------------------------------------------

/** Net-new Phase 1 tools (see `src/core/agents/tools`). */
export const CORE_TOOL_KEYS = ["calculator", "current_datetime", "workspace_usage_summary"] as const;
export type CoreToolKey = (typeof CORE_TOOL_KEYS)[number];

/**
 * Full Phase 1 tool allowlist: the three required core tools plus the
 * pre-existing safe mock tools already allowlisted in `src/lib/agents`
 * (all synthetic, local, no network/filesystem/SQL/email/payment side
 * effects). Anything not in this set is rejected before it ever reaches
 * the execution engine.
 */
export const ALLOWED_TOOL_KEYS: readonly string[] = Array.from(
  new Set<string>([...CORE_TOOL_KEYS, ...MOCK_TOOL_KEYS]),
);

/** Tool names that must NEVER be allowlisted, regardless of future changes — defense in depth for the allowlist check. */
export const FORBIDDEN_TOOL_KEYS: readonly string[] = [
  "shell",
  "exec",
  "http_request",
  "fetch_url",
  "http",
  "filesystem_write",
  "write_file",
  "fs_write",
  "raw_sql",
  "sql",
  "execute_sql",
  "send_email",
  "email_send",
  "payment",
  "charge_card",
  "create_payment",
  "stripe_charge",
];

export function isAllowedToolKey(key: string): key is CoreToolKey | MockToolKey {
  if (!key) return false;
  if (FORBIDDEN_TOOL_KEYS.includes(key)) return false;
  return ALLOWED_TOOL_KEYS.includes(key);
}
