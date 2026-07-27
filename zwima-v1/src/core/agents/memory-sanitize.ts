/**
 * M8 Phase 2B — Memory context sanitization (prompt-injection hardening).
 *
 * Memory is untrusted historical reference data. Sanitization does not claim
 * to eliminate prompt injection; it applies layered defenses before injection.
 */

import {
  MAX_MEMORY_CONTEXT_TOTAL_CHARS,
  MAX_MEMORY_INJECTION_ENTRY_CHARS,
  MEMORY_INJECTION_OVERRIDE_PATTERNS,
} from "./agent-safety";

/** Escape HTML special chars for safe UI rendering (never treat memory as HTML). */
export function escapeHtmlForMemoryDisplay(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip / neutralize common instruction-override patterns from memory content
 * before it is injected into a run. Returns sanitized text (may be empty).
 */
export function sanitizeMemoryContentForInjection(raw: string): string {
  let text = raw.slice(0, MAX_MEMORY_INJECTION_ENTRY_CHARS);
  for (const pattern of MEMORY_INJECTION_OVERRIDE_PATTERNS) {
    text = text.replace(pattern, "[filtered]");
  }
  // Collapse runs of filtered markers
  text = text.replace(/(\[filtered\]\s*){2,}/gi, "[filtered] ");
  return text.trim();
}

export function truncateMemoryContextTotal(block: string): string {
  if (block.length <= MAX_MEMORY_CONTEXT_TOTAL_CHARS) return block;
  return `${block.slice(0, MAX_MEMORY_CONTEXT_TOTAL_CHARS)}\n…[memory context truncated]`;
}

export function looksLikeInstructionOverride(value: string): boolean {
  return MEMORY_INJECTION_OVERRIDE_PATTERNS.some((re) => re.test(value));
}
