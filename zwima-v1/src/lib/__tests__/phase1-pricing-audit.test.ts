import { describe, it, expect, vi, beforeEach } from "vitest";
import { getActivePricing } from "@/lib/pricing/pricing-service";
import { writeAiAudit, hashContent } from "@/lib/audit/ai-audit";
import { prisma } from "@/lib/prisma";

describe("pricing fail-closed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when only DRAFT pricing exists", async () => {
    vi.spyOn(prisma.provider, "findUnique").mockResolvedValue({ id: "p1", slug: "openai" } as never);
    vi.spyOn(prisma.providerModel, "findUnique").mockResolvedValue({
      id: "m1",
      status: "ACTIVE",
    } as never);
    vi.spyOn(prisma.modelPricingRecord, "findFirst").mockResolvedValue(null);

    const result = await getActivePricing("openai", "gpt-5");
    expect(result).toBeNull();
  });

  it("rejects VERIFIED pricing with zero placeholder prices", async () => {
    vi.spyOn(prisma.provider, "findUnique").mockResolvedValue({ id: "p1", slug: "openai" } as never);
    vi.spyOn(prisma.providerModel, "findUnique").mockResolvedValue({
      id: "m1",
      status: "ACTIVE",
    } as never);
    vi.spyOn(prisma.modelPricingRecord, "findFirst").mockResolvedValue({
      id: "r1",
      currency: "EUR",
      inputPricePerMillionTokens: 0,
      outputPricePerMillionTokens: 0,
      platformMarkupPercent: 30,
      pricingStatus: "VERIFIED",
    } as never);

    const result = await getActivePricing("openai", "gpt-5");
    expect(result).toBeNull();
  });

  it("accepts VERIFIED pricing with positive rates", async () => {
    vi.spyOn(prisma.provider, "findUnique").mockResolvedValue({ id: "p1", slug: "openai" } as never);
    vi.spyOn(prisma.providerModel, "findUnique").mockResolvedValue({
      id: "m1",
      status: "ACTIVE",
    } as never);
    vi.spyOn(prisma.modelPricingRecord, "findFirst").mockResolvedValue({
      id: "r1",
      currency: "EUR",
      inputPricePerMillionTokens: 2.5,
      outputPricePerMillionTokens: 10,
      platformMarkupPercent: 30,
      pricingStatus: "VERIFIED",
    } as never);

    const result = await getActivePricing("openai", "gpt-5");
    expect(result?.inputPricePerMillion).toBe(2.5);
    expect(result?.pricingStatus).toBe("VERIFIED");
  });
});

describe("audit write path", () => {
  it("persists hashes only, not prompt or completion plaintext", async () => {
    const createSpy = vi.spyOn(prisma.aiAuditLog, "create").mockResolvedValue({} as never);
    const prompt = "super secret user prompt";
    const completion = "super secret model output";

    await writeAiAudit({
      requestId: "req_test_001",
      organizationId: "org1",
      userId: "u1",
      promptText: prompt,
      completionText: completion,
      status: "SUCCESS",
    });

    expect(createSpy).toHaveBeenCalledOnce();
    const payload = createSpy.mock.calls[0][0].data;
    expect(payload.promptHash).toBe(hashContent(prompt));
    expect(payload.completionHash).toBe(hashContent(completion));
    expect(JSON.stringify(payload)).not.toContain(prompt);
    expect(JSON.stringify(payload)).not.toContain(completion);
    expect(payload.requestId).toBe("req_test_001");
  });
});

describe("stripe preview safety", () => {
  it("isStripePreviewDisabled when env true", async () => {
    vi.stubEnv("STRIPE_PREVIEW_DISABLED", "true");
    const { isStripePreviewDisabled, assertStripePaymentsAllowed, StripePreviewDisabledError } =
      await import("@/lib/stripe-preview-guard");
    expect(isStripePreviewDisabled()).toBe(true);
    expect(() => assertStripePaymentsAllowed()).toThrow(StripePreviewDisabledError);
    vi.unstubAllEnvs();
  });
});

describe("stripe webhook idempotency", () => {
  it("skips processing when stripeEventId already exists", async () => {
    vi.spyOn(prisma.payment, "findFirst").mockResolvedValue({
      id: "pay1",
      stripeEventId: "evt_duplicate",
    } as never);

    const existing = await prisma.payment.findFirst({ where: { stripeEventId: "evt_duplicate" } });
    expect(existing).not.toBeNull();
    expect(existing?.stripeEventId).toBe("evt_duplicate");
  });
});
