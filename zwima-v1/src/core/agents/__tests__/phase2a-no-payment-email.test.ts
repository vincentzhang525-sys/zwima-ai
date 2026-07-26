import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static source scan: none of the new M8 Phase 2A modules may reference
 * Stripe, Resend/email-sending, or any live HTTP/model provider SDK. This
 * complements the runtime tests (which prove the *mock* execution path never
 * calls out) by proving the source code has no such import at all.
 */
const PHASE2A_FILES = [
  "../template-catalog.ts",
  "../template-service.ts",
  "../memory-policy-service.ts",
  "../memory-phase2-service.ts",
  "../from-template-service.ts",
  "../agent-runner.ts",
].map((rel) => path.resolve(__dirname, rel));

const FORBIDDEN_PATTERNS: RegExp[] = [
  /from ["']stripe["']/i,
  /require\(["']stripe["']\)/i,
  /checkout\.stripe\.com/i,
  /from ["']resend["']/i,
  /require\(["']resend["']\)/i,
  /openai/i,
  /anthropic/i,
  /\bfetch\(\s*["'`]https?:/i,
];

describe("M8 Phase 2A modules never reference payment/email/live-provider SDKs", () => {
  it.each(PHASE2A_FILES)("%s is clean", (file) => {
    expect(fs.existsSync(file)).toBe(true);
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});
