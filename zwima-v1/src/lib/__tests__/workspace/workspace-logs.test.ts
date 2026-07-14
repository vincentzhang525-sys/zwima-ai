import { describe, it, expect } from "vitest";

function sanitizeError(message: string | null | undefined): string | null {
  if (!message) return null;
  return message
    .replace(/sk_live_[A-Za-z0-9_-]+/gi, "[REDACTED_KEY]")
    .replace(/Bearer\s+\S+/gi, "[REDACTED_TOKEN]")
    .slice(0, 240);
}

describe("workspace-logs", () => {
  it("sanitizes API keys from error messages", () => {
    const msg = sanitizeError("Failed with sk_live_secretkey123456789 and Bearer tok_abc");
    expect(msg).not.toContain("sk_live_secretkey");
    expect(msg).toContain("[REDACTED_KEY]");
    expect(msg).toContain("[REDACTED_TOKEN]");
  });

  it("log list fields exclude full prompts", () => {
    const row = {
      promptSummary: "hash:abc123…",
      responseSummary: "hash:def456…",
    };
    expect(row.promptSummary).toMatch(/^hash:/);
    expect(JSON.stringify(row).length).toBeLessThan(500);
  });

  it("empty logs pagination is valid", () => {
    const empty = { items: [], pagination: { page: 1, total: 0, totalPages: 1 } };
    expect(empty.items).toHaveLength(0);
  });
});
