import { describe, expect, it } from "vitest";
import {
  looksSensitive,
  sanitizeForLog,
  stripPromptBodies,
} from "@/lib/logging/sanitize";

describe("GAP-011 sanitizeForLog", () => {
  it("redacts API keys and Stripe webhook secrets", () => {
    const raw =
      "key=sk_live_abc123XYZ and stripe whsec_deadbeef and Bearer tok.en-1";
    const out = sanitizeForLog(raw);
    expect(out).not.toContain("sk_live_abc123XYZ");
    expect(out).not.toContain("whsec_deadbeef");
    expect(out).toContain("[REDACTED_API_KEY]");
    expect(out).toContain("[REDACTED_WEBHOOK_SECRET]");
    expect(out).toContain("Bearer [REDACTED]");
  });

  it("stripPromptBodies removes full prompt content", () => {
    const stripped = stripPromptBodies({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "secret customer PII 123" }],
    });
    expect(stripped.messages?.[0]?.content).toBe("[REDACTED_PROMPT]");
    expect(JSON.stringify(stripped)).not.toContain("secret customer PII");
  });

  it("looksSensitive detects key material", () => {
    expect(looksSensitive("sk_test_xxx")).toBe(true);
    expect(looksSensitive("normal log line")).toBe(false);
  });
});
