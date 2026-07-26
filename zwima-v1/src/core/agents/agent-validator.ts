/**
 * M8 Agent Platform Phase 1 — input/tool validation.
 *
 * Pure functions, no I/O. Kept separate from `agent-safety.ts` (constants)
 * and `agent-runner.ts` (orchestration) so they can be unit tested in
 * isolation.
 */

import { AgentServiceError } from "@/lib/agents/errors";
import { MAX_AGENT_INPUT_CHARS, isAllowedToolKey } from "./agent-safety";

/**
 * Very small heuristic filter for obvious prompt-injection phrasing in
 * user-supplied run input. This is NOT a security boundary by itself (the
 * mock provider never executes instructions against real systems), but it
 * gives Phase 1 a documented, testable first line of defense and a place to
 * extend later. It flags — it does not silently rewrite — suspicious input.
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|previous|prior) (instructions|prompts|rules)/i,
  /disregard (all|any|previous|prior) (instructions|prompts|rules)/i,
  /you are now (in )?(developer|dan|jailbreak|unrestricted) mode/i,
  /reveal (your|the) (system prompt|hidden instructions|api key)/i,
  /act as if you have no (restrictions|guardrails|policies)/i,
  /\bsk-[a-zA-Z0-9]{16,}\b/,
];

export function containsPromptInjection(text: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((re) => re.test(text));
}

function flattenTextForScan(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => flattenTextForScan(v, depth + 1)).join("\n");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((v) => flattenTextForScan(v, depth + 1))
      .join("\n");
  }
  return "";
}

export type ValidatedRunInput = {
  raw: Record<string, unknown>;
  text: string;
  flaggedPromptInjection: boolean;
};

/**
 * Validates a run's `input` payload: total size and a basic prompt-injection
 * scan. Throws `AgentServiceError("VALIDATION_ERROR", ..., 400)` on
 * oversized input. Prompt-injection matches are flagged on the result
 * rather than rejected outright (the mock provider cannot act on
 * instructions anyway), so callers/tests can assert on the flag.
 */
export function validateRunInput(input: unknown): ValidatedRunInput {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const text = flattenTextForScan(raw);
  if (text.length > MAX_AGENT_INPUT_CHARS) {
    throw new AgentServiceError(
      "VALIDATION_ERROR",
      `Run input exceeds maximum size of ${MAX_AGENT_INPUT_CHARS} characters`,
      400,
    );
  }
  return { raw, text, flaggedPromptInjection: containsPromptInjection(text) };
}

/**
 * Validates a requested tool call name against the Phase 1 allowlist.
 * Throws `AgentServiceError("TOOL_NOT_ALLOWED", ..., 403)` for anything not
 * on the allowlist (including all forbidden categories: shell, arbitrary
 * HTTP, filesystem write, raw SQL, email send, payment).
 */
export function validateToolRequest(toolKey: string | undefined | null): void {
  if (!toolKey) return;
  if (!isAllowedToolKey(toolKey)) {
    throw new AgentServiceError(
      "TOOL_NOT_ALLOWED",
      `Tool '${toolKey}' is not on the Phase 1 allowlist`,
      403,
    );
  }
}

/** Redacts a system prompt down to a short, non-reversible preview for logs/audit rows. Never store or return the full prompt from a log. */
export function redactSystemPrompt(systemPrompt: string): { preview: string; length: number } {
  const trimmed = systemPrompt.trim();
  const preview = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
  return { preview, length: trimmed.length };
}

/** Basic secret-shaped-string scan, used both defensively (never persist matches) and by tests asserting no leakage. */
const SECRET_LIKE_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bsk_live_[a-zA-Z0-9]{10,}\b/,
  /\bsk_test_[a-zA-Z0-9]{10,}\b/,
  /\bwhsec_[a-zA-Z0-9]{10,}\b/,
  /\bre_[a-zA-Z0-9]{10,}\b/,
  /\bAKIA[0-9A-Z]{12,}\b/,
];

export function containsSecretLikeString(text: string): boolean {
  return SECRET_LIKE_PATTERNS.some((re) => re.test(text));
}
