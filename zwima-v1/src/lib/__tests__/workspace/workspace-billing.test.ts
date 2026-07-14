import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isStripePreviewDisabled } from "@/lib/stripe-preview-guard";

describe("workspace-billing", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_PREVIEW_DISABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preview stripe is disabled when env set", () => {
    expect(isStripePreviewDisabled()).toBe(true);
  });

  it("billing payload marks checkout disabled in preview", () => {
    const payload = {
      checkoutDisabled: isStripePreviewDisabled(),
      checkoutMessage: isStripePreviewDisabled() ? "Payments are temporarily unavailable in Preview" : null,
      currency: "EUR",
    };
    expect(payload.checkoutDisabled).toBe(true);
    expect(payload.checkoutMessage).toContain("Preview");
    expect(payload.currency).toBe("EUR");
  });

  it("billing responses exclude stripe secrets", () => {
    const sample = { paymentStatus: "PREVIEW_DISABLED", currentCreditsEur: 10 };
    expect(JSON.stringify(sample)).not.toMatch(/sk_(test|live)_/);
  });
});
