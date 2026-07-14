import type { SmartRoutingDecision, RoutingRequestContext } from "./routing-types";

export function buildRoutingResponseHeaders(decision: SmartRoutingDecision): Record<string, string> {
  const headers: Record<string, string> = {
    "x-zwima-provider": decision.selectedProviderSlug,
    "x-zwima-model": decision.selectedModelId,
    "x-zwima-routing-mode": decision.optimizationMode,
    "x-zwima-routing-reason": decision.decisionReasons[0] ?? "smart-routing",
    "x-zwima-estimated-cost": decision.estimatedCostEur.toFixed(6),
    "x-zwima-fallback-count": "0",
  };
  if (decision.complianceFlags.transparencyRequired) {
    headers["x-zwima-ai-generated"] = "true";
    headers["x-zwima-transparency-required"] = "true";
  }
  if (decision.complianceFlags.deepfakeDisclosureRequired) {
    headers["x-zwima-synthetic-media-disclosure"] = "required";
  }
  return headers;
}

export function smartDecisionToLegacyRouting(decision: SmartRoutingDecision) {
  return {
    selected: {
      providerSlug: decision.selectedProviderSlug,
      providerId: decision.selectedProviderId,
      modelCode: decision.selectedModelId,
      providerModelId: decision.selectedProviderModelId,
      displayName: decision.selectedModelName,
      region: decision.selectedRegion,
      qualityTier: "STANDARD",
      estimatedProviderCostEur: decision.estimatedCostEur,
      estimatedCustomerCharge: decision.estimatedCustomerChargeCredits,
      estimatedMarginPercent: 0,
      healthStatus: "HEALTHY",
      scores: {
        cost: decision.scoreBreakdown?.costScore ?? 0,
        latency: decision.scoreBreakdown?.latencyScore ?? 0,
        quality: decision.scoreBreakdown?.qualityScore ?? 0,
        reliability: decision.scoreBreakdown?.reliabilityScore ?? 0,
        region: decision.scoreBreakdown?.complianceScore ?? 0,
        total: decision.totalScore / 100,
      },
    },
    candidates: decision.candidates.map((c) => ({
      providerSlug: c.providerSlug,
      providerId: c.providerId,
      modelCode: c.modelId,
      providerModelId: c.providerModelId,
      displayName: c.modelName,
      qualityTier: "STANDARD",
      estimatedProviderCostEur: c.estimatedRequestCostEur,
      estimatedCustomerCharge: c.estimatedCustomerChargeCredits,
      estimatedMarginPercent: 0,
      healthStatus: "HEALTHY",
      excluded: c.excluded,
      exclusionReason: c.exclusionReasons.join("; "),
    })),
    excluded: decision.rejectedCandidates.map((c) => ({
      providerSlug: c.providerSlug,
      providerId: c.providerId,
      modelCode: c.modelId,
      providerModelId: c.providerModelId,
      displayName: c.modelName,
      qualityTier: "STANDARD",
      estimatedProviderCostEur: 0,
      estimatedCustomerCharge: 0,
      estimatedMarginPercent: 0,
      healthStatus: "UNKNOWN",
      excluded: true,
      exclusionReason: c.exclusionReasons.join("; "),
    })),
    strategy: mapModeToStrategy(decision.optimizationMode),
    routingReason: decision.decisionReasons.join("; "),
    estimatedCost: decision.estimatedCostEur,
    estimatedCustomerCharge: decision.estimatedCustomerChargeCredits,
    estimatedMarginPercent: 0,
    fallbackCount: 0,
    attemptedProviders: [decision.selectedProviderSlug],
  };
}

function mapModeToStrategy(mode: string) {
  const map: Record<string, "BALANCED" | "LOWEST_COST" | "LOWEST_LATENCY" | "HIGHEST_QUALITY" | "EU_PREFERRED"> = {
    BALANCED: "BALANCED",
    LOWEST_COST: "LOWEST_COST",
    LOWEST_LATENCY: "LOWEST_LATENCY",
    HIGHEST_QUALITY: "HIGHEST_QUALITY",
    EU_COMPLIANCE: "EU_PREFERRED",
  };
  return map[mode] ?? "BALANCED";
}

export function summarizeContext(context: RoutingRequestContext) {
  return {
    capability: context.capability,
    region: context.region,
    euOnly: context.euOnly,
    optimizationMode: context.optimizationMode,
    streamingRequired: context.streamingRequired,
  };
}
