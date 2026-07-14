import { describe, expect, it } from "vitest";
import { scoreSmartCandidates, selectTopSmartCandidate } from "../routing/scoring-engine";
import type { ProviderCandidate } from "../routing/routing-types";

const base = (): ProviderCandidate => ({
  providerId: "p1", providerName: "P", providerSlug: "openai", modelId: "m", modelName: "M", providerModelId: "pm",
  enabled: true, providerStatus: "ACTIVE", modelStatus: "ACTIVE", region: "EU", supportedRegions: ["EU"],
  supportsStreaming: true, supportsEmbedding: false, supportsImage: false, supportsAudio: false, supportsVideo: false,
  inputPrice: 1, outputPrice: 2, cacheReadPrice: 0, cacheWritePrice: 0, estimatedRequestCostEur: 0.01,
  estimatedCustomerChargeCredits: 10, latencyP50: 200, latencyP95: 400, successRate: 99, errorRate: 1,
  qualityScore: 70, routingPriority: 0, routingWeight: 100, promotionActive: false, promotionEndDate: null,
  euCompliant: true, dataResidencyRegions: ["EU"], hasApiKey: true, excluded: false, exclusionReasons: [], totalScore: 0,
});

describe("routing-scoring isolated", () => {
  it("HIGHEST_QUALITY picks higher qualityScore", () => {
    const low = { ...base(), qualityScore: 40, providerSlug: "a", estimatedRequestCostEur: 0.001 };
    const high = { ...base(), qualityScore: 95, providerSlug: "b", providerId: "p2" };
    scoreSmartCandidates([low, high], "HIGHEST_QUALITY");
    expect(selectTopSmartCandidate([low, high])?.qualityScore).toBe(95);
  });
});
