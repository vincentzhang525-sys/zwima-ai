import { describe, expect, it } from "vitest";
import {
  assertStripeTestModeForClosedBeta,
  classifyStripeKey,
  StripeModeMismatchError,
  STRIPE_MODE_MISMATCH,
  stripeModeDiagnostic,
} from "@/lib/stripe-mode-gate";

describe("stripe-mode-gate (GAP-002)", () => {
  it("classifies test and live prefixes", () => {
    expect(classifyStripeKey("sk_test_x", "secret")).toBe("test");
    expect(classifyStripeKey("sk_live_x", "secret")).toBe("live");
    expect(classifyStripeKey("pk_test_x", "publishable")).toBe("test");
    expect(classifyStripeKey("pk_live_x", "publishable")).toBe("live");
  });

  it("allows sk_test_ when Closed Beta test-only is on", () => {
    expect(() =>
      assertStripeTestModeForClosedBeta({
        CLOSED_BETA_STRIPE_TEST_ONLY: "true",
        STRIPE_SECRET_KEY: "sk_test_abc",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
      }),
    ).not.toThrow();
  });

  it("rejects live keys under Closed Beta test-only", () => {
    try {
      assertStripeTestModeForClosedBeta({
        CLOSED_BETA_STRIPE_TEST_ONLY: "true",
        STRIPE_SECRET_KEY: "sk_live_abc",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abc",
      });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(StripeModeMismatchError);
      expect((e as StripeModeMismatchError).code).toBe(STRIPE_MODE_MISMATCH);
    }
  });

  it("can be disabled with CLOSED_BETA_STRIPE_TEST_ONLY=false", () => {
    expect(() =>
      assertStripeTestModeForClosedBeta({
        CLOSED_BETA_STRIPE_TEST_ONLY: "false",
        STRIPE_SECRET_KEY: "sk_live_abc",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abc",
      }),
    ).not.toThrow();
  });

  it("diagnostic never includes key bodies", () => {
    const diag = stripeModeDiagnostic({
      STRIPE_SECRET_KEY: "sk_test_SECRET_BODY",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_SECRET_BODY",
      CLOSED_BETA_STRIPE_TEST_ONLY: "true",
    });
    const json = JSON.stringify(diag);
    expect(json).not.toContain("SECRET_BODY");
    expect(diag.secretKind).toBe("test");
    expect(diag.isolated).toBe(true);
  });
});
