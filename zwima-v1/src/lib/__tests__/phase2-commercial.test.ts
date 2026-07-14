import { describe, expect, it } from "vitest";
import { calculateFromRecord } from "../cost/cost-calculator-v2";
import { buildTransparencyHeaders } from "../compliance/ai-compliance";
import { isRoutableStatus } from "../model-lifecycle/lifecycle-service";
import { toAdminStatus, toDbStatus } from "../model-lifecycle/lifecycle-status";

describe("Phase 2 — model lifecycle", () => {
  it("ACTIVE is routable in production", () => {
    expect(isRoutableStatus("ACTIVE", "production")).toBe(true);
  });

  it("PREVIEW is routable only on preview env", () => {
    expect(isRoutableStatus("PREVIEW", "preview")).toBe(true);
    expect(isRoutableStatus("PREVIEW", "production")).toBe(false);
  });

  it("DISABLED maps to non-routable INACTIVE", () => {
    expect(toDbStatus("DISABLED")).toBe("INACTIVE");
    expect(toAdminStatus("INACTIVE")).toBe("DISABLED");
    expect(isRoutableStatus("INACTIVE", "production")).toBe(false);
  });
});

describe("Phase 2 — cost calculator V2", () => {
  const baseRecord = {
    id: "pr1",
    providerModelId: "m1",
    currency: "EUR" as const,
    inputPricePerMillionTokens: 1,
    cachedInputPricePerMillionTokens: 0.25,
    cacheWritePricePerMillionTokens: 0.5,
    outputPricePerMillionTokens: 2,
    longContextPricePerMillionTokens: 3,
    requestPrice: null,
    imagePrice: null,
    audioPrice: null,
    searchToolPricePerRequest: 0.01,
    batchDiscount: 0.1,
    retryCostMultiplier: 1.5,
    providerDiscount: null,
    internalCostMultiplier: 1,
    platformMarkupPercent: 30,
    minimumCharge: null,
    effectiveFrom: new Date("2026-01-01"),
    effectiveUntil: null,
    promotionName: null,
    promotionActive: false,
    promotionEndDate: null,
    pricingStatus: "VERIFIED" as const,
    sourceUrl: null,
    verifiedAt: null,
    verifiedBy: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("calculates cache read/write and search tool", () => {
    const result = calculateFromRecord(baseRecord, {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cachedInputTokens: 200_000,
      cacheWriteTokens: 100_000,
      searchToolCalls: 2,
    });
    expect(result.providerCostEur).toBeCloseTo(1 + 1 + 0.05 + 0.05 + 0.02, 2);
    expect(result.breakdown.cacheRead).toBeCloseTo(0.05, 4);
    expect(result.breakdown.cacheWrite).toBeCloseTo(0.05, 4);
    expect(result.breakdown.searchTool).toBeCloseTo(0.02, 4);
  });

  it("applies batch discount and retry surcharge", () => {
    const result = calculateFromRecord(baseRecord, {
      inputTokens: 1_000_000,
      outputTokens: 0,
      batchMode: true,
      retryCount: 1,
    });
    expect(result.breakdown.batchDiscountApplied).toBeGreaterThan(0);
    expect(result.breakdown.retrySurcharge).toBeGreaterThan(0);
  });

  it("calculates margin and suggested selling price", () => {
    const result = calculateFromRecord(baseRecord, {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(result.providerCostEur).toBeCloseTo(1, 2);
    expect(result.suggestedSellingPriceEur).toBeGreaterThan(result.providerCostEur);
    expect(result.marginPercent).toBeCloseTo(30, 0);
  });
});

describe("Phase 2 — AI compliance", () => {
  it("emits transparency headers when required", () => {
    const headers = buildTransparencyHeaders({
      transparencyRequired: true,
      aiGeneratedLabelRequired: true,
      deepfakeDisclosureRequired: true,
      complianceStatus: "COMPLIANT",
    });
    expect(headers["X-AI-Generated"]).toBe("true");
    expect(headers["X-AI-Synthetic-Media-Disclosure"]).toBe("required");
  });

  it("exempt models emit no headers", () => {
    const headers = buildTransparencyHeaders({
      transparencyRequired: true,
      aiGeneratedLabelRequired: true,
      deepfakeDisclosureRequired: true,
      complianceStatus: "EXEMPT",
    });
    expect(Object.keys(headers)).toHaveLength(0);
  });
});
