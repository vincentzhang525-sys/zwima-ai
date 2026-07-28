/**
 * GAP-011 — redact secrets / sensitive payloads from logs and error surfaces.
 * Never log API keys, Stripe secrets, or full prompts.
 */

const PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /\bsk_live_[A-Za-z0-9_-]+\b/g, replacement: "[REDACTED_API_KEY]" },
  { re: /\bsk_test_[A-Za-z0-9_-]+\b/g, replacement: "[REDACTED_API_KEY]" },
  { re: /\bpk_live_[A-Za-z0-9_-]+\b/g, replacement: "[REDACTED_PK]" },
  { re: /\bpk_test_[A-Za-z0-9_-]+\b/g, replacement: "[REDACTED_PK]" },
  { re: /\bwhsec_[A-Za-z0-9]+\b/g, replacement: "[REDACTED_WEBHOOK_SECRET]" },
  { re: /\bBearer\s+[A-Za-z0-9._-]+\b/gi, replacement: "Bearer [REDACTED]" },
  { re: /postgres(?:ql)?:\/\/[^\s"']+/gi, replacement: "[REDACTED_DATABASE_URL]" },
];

export function sanitizeForLog(input: unknown): string {
  let text = typeof input === "string" ? input : safeJson(input);
  for (const { re, replacement } of PATTERNS) {
    text = text.replace(re, replacement);
  }
  return text;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Drop message bodies before any diagnostic serialization. */
export function stripPromptBodies<T extends { messages?: { role?: string; content?: string }[] }>(
  body: T,
): Omit<T, "messages"> & { messages?: { role?: string; content: string }[] } {
  if (!body?.messages) return { ...body, messages: undefined };
  return {
    ...body,
    messages: body.messages.map((m) => ({
      role: m.role,
      content: "[REDACTED_PROMPT]",
    })),
  };
}

export function looksSensitive(text: string): boolean {
  return (
    /sk_(live|test)_/i.test(text) ||
    /whsec_/i.test(text) ||
    /Bearer\s+[A-Za-z0-9]/i.test(text) ||
    /postgres(?:ql)?:\/\//i.test(text)
  );
}
