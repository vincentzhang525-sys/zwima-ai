import { describe, expect, it } from "vitest";
import { getTransparencyEnforcementDate } from "../routing/policy-config";
import { buildRoutingResponseHeaders } from "../routing/routing-decision";
import type { SmartRoutingDecision } from "../routing/routing-types";

describe("routing-compliance isolated", () => {
  it("EU transparency metadata in headers", () => {
    const d = {
      selectedProviderSlug: "gemini",
      selectedModelId: "flash",
      optimizationMode: "EU_COMPLIANCE",
      estimatedCostEur: 0.001,
      decisionReasons: [],
      complianceFlags: {
        transparencyRequired: true,
        aiGeneratedLabelRequired: true,
        deepfakeDisclosureRequired: true,
        euDataResidency: true,
        enforcementActive: getTransparencyEnforcementDate() <= new Date("2026-08-03"),
      },
    } as SmartRoutingDecision;
    const h = buildRoutingResponseHeaders(d);
    expect(h["x-zwima-synthetic-media-disclosure"]).toBe("required");
  });
});
