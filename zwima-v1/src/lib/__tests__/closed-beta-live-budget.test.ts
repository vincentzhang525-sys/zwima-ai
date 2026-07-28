import { describe, expect, it } from "vitest";
import {
  assertClosedBetaLiveChatAllowed,
  clampMaxTokensForClosedBeta,
  ClosedBetaLiveBudgetError,
  CLOSED_BETA_LIVE_BUDGET_EXCEEDED,
  parseAllowedModels,
} from "@/lib/providers/closed-beta-live-budget";

describe("closed-beta-live-budget (GAP-001)", () => {
  it("defaults to cheap OpenAI model allowlist", () => {
    expect(parseAllowedModels({})).toEqual(["gpt-5-nano", "gpt-5-mini", "gpt-4o-mini"]);
  });

  it("allows gpt-5-nano within token cap", () => {
    expect(() =>
      assertClosedBetaLiveChatAllowed({
        providerSlug: "openai",
        model: "gpt-5-nano",
        maxTokens: 16,
        env: {},
      }),
    ).not.toThrow();
  });

  it("rejects non-openai when provider lock is openai", () => {
    expect(() =>
      assertClosedBetaLiveChatAllowed({
        providerSlug: "anthropic",
        model: "gpt-5-nano",
        maxTokens: 16,
        env: { CLOSED_BETA_PROVIDER_LOCK: "openai" },
      }),
    ).toThrow(ClosedBetaLiveBudgetError);
  });

  it("rejects models outside allowlist", () => {
    try {
      assertClosedBetaLiveChatAllowed({
        providerSlug: "openai",
        model: "gpt-5",
        maxTokens: 16,
        env: {},
      });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ClosedBetaLiveBudgetError);
      expect((e as ClosedBetaLiveBudgetError).code).toBe(CLOSED_BETA_LIVE_BUDGET_EXCEEDED);
    }
  });

  it("rejects oversized maxTokens", () => {
    expect(() =>
      assertClosedBetaLiveChatAllowed({
        providerSlug: "openai",
        model: "gpt-5-nano",
        maxTokens: 9999,
        env: { CLOSED_BETA_MAX_OUTPUT_TOKENS: "64" },
      }),
    ).toThrow(/maxTokens/);
  });

  it("clamps max tokens to closed-beta ceiling", () => {
    expect(clampMaxTokensForClosedBeta(2048, { CLOSED_BETA_MAX_OUTPUT_TOKENS: "32" })).toBe(32);
    expect(clampMaxTokensForClosedBeta(null, { CLOSED_BETA_MAX_OUTPUT_TOKENS: "32" })).toBe(16);
  });
});
