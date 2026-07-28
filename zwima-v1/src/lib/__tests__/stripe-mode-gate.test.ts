import { describe, expect, it } from "vitest";
import {
  assertStripeTestModeForClosedBeta,
  classifyStripeKey,
  isClosedBetaStripeTestOnly,
  stripeModeDiagnostic,
} from "@/lib/stripe-mode-gate";
import {
  webhookIdempotencyCodePathOk,
  webhookIdempotencySchemaOk,
} from "@/lib/billing/gap002-stripe-acceptance";

describe("stripe-mode-gate (GAP-002 live commercial)", () => {
  it("classifies live and test prefixes", () => {
    expect(classifyStripeKey("sk_live_x", "secret")).toBe("live");
    expect(classifyStripeKey("pk_live_x", "publishable")).toBe("live");
    expect(classifyStripeKey("sk_test_x", "secret")).toBe("test");
  });

  it("defaults test-only OFF so Live Closed Beta is allowed", () => {
    expect(isClosedBetaStripeTestOnly({})).toBe(false);
    expect(() =>
      assertStripeTestModeForClosedBeta({
        STRIPE_SECRET_KEY: "sk_live_abc",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abc",
      }),
    ).not.toThrow();
  });

  it("still rejects live when CLOSED_BETA_STRIPE_TEST_ONLY=true (opt-in)", () => {
    expect(() =>
      assertStripeTestModeForClosedBeta({
        CLOSED_BETA_STRIPE_TEST_ONLY: "true",
        STRIPE_SECRET_KEY: "sk_live_abc",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abc",
      }),
    ).toThrow(/TEST_ONLY/);
  });

  it("diagnostic never includes key bodies", () => {
    const diag = stripeModeDiagnostic({
      STRIPE_SECRET_KEY: "sk_live_SECRET_BODY",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_SECRET_BODY",
    });
    expect(JSON.stringify(diag)).not.toContain("SECRET_BODY");
    expect(diag.secretKind).toBe("live");
    expect(diag.isolated).toBe(true);
  });
});

describe("gap002 webhook idempotency evidence", () => {
  it("schema unique stripeEventId and code path are present", () => {
    expect(webhookIdempotencySchemaOk()).toBe(true);
    expect(webhookIdempotencyCodePathOk()).toBe(true);
  });
});
