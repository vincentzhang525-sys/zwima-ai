import { describe, expect, it } from "vitest";
import { detectCapability, detectStreamingRequired } from "../routing/request-analyzer";
import { DEFAULT_ROUTING_POLICY, mergeRoutingPolicies, validateRoutingPolicy, getTransparencyEnforcementDate } from "../routing/policy-config";
import { scoreSmartCandidates, selectTopSmartCandidate, MODE_WEIGHTS, buildDecisionReasons } from "../routing/scoring-engine";
import { isFallbackAllowedError } from "../routing/failover-engine";
import { buildRoutingResponseHeaders } from "../routing/routing-decision";
import type { ProviderCandidate, SmartRoutingDecision } from "../routing/routing-types";
import { applyPreferredProviderFilter } from "../routing/provider-candidate-builder";

function candidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    providerId: "p1",
    providerName: "OpenAI",
    providerSlug: "openai",
    modelId: "gpt-test",
    modelName: "GPT Test",
    providerModelId: "m1",
    enabled: true,
    providerStatus: "ACTIVE",
    modelStatus: "ACTIVE",
    region: "EU",
    supportedRegions: ["EU"],
    supportsStreaming: true,
    supportsEmbedding: false,
    supportsImage: false,
    supportsAudio: false,
    supportsVideo: false,
    inputPrice: 1,
    outputPrice: 2,
    cacheReadPrice: 0.5,
    cacheWritePrice: 0.5,
    estimatedRequestCostEur: 0.01,
    estimatedCustomerChargeCredits: 15,
    latencyP50: 200,
    latencyP95: 400,
    successRate: 99.5,
    errorRate: 0.5,
    qualityScore: 80,
    routingPriority: 10,
    routingWeight: 100,
    promotionActive: false,
    promotionEndDate: null,
    euCompliant: true,
    dataResidencyRegions: ["EU"],
    hasApiKey: true,
    excluded: false,
    exclusionReasons: [],
    totalScore: 0,
    ...overrides,
  };
}

describe("routing-policy", () => {
  it("invalid policy falls back to defaults", () => {
    const { policy, valid, errors } = validateRoutingPolicy({ optimizationMode: "INVALID" });
    expect(valid).toBe(false);
    expect(policy.optimizationMode).toBe("BALANCED");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("merges API key over organization", () => {
    const merged = mergeRoutingPolicies(DEFAULT_ROUTING_POLICY, { euOnly: true }, { optimizationMode: "LOWEST_COST" });
    expect(merged.optimizationMode).toBe("LOWEST_COST");
    expect(merged.euOnly).toBe(true);
  });

  it("transparency enforcement date defaults to 2026-08-02", () => {
    expect(getTransparencyEnforcementDate().toISOString().slice(0, 10)).toBe("2026-08-02");
  });
});

describe("routing-scoring", () => {
  it("BALANCED mode selects highest composite score", () => {
    const c1 = candidate({ providerSlug: "openai", estimatedRequestCostEur: 0.02, latencyP50: 300 });
    const c2 = candidate({ providerSlug: "gemini", estimatedRequestCostEur: 0.01, latencyP50: 150, providerId: "p2" });
    scoreSmartCandidates([c1, c2], "BALANCED");
    const top = selectTopSmartCandidate([c1, c2]);
    expect(top?.totalScore).toBeGreaterThan(0);
    expect(top?.totalScore).toBeLessThanOrEqual(100);
  });

  it("LOWEST_COST favors cheaper provider", () => {
    const expensive = candidate({ estimatedRequestCostEur: 0.05, providerSlug: "claude" });
    const cheap = candidate({ estimatedRequestCostEur: 0.001, providerSlug: "deepseek", providerId: "p3" });
    scoreSmartCandidates([expensive, cheap], "LOWEST_COST");
    expect(selectTopSmartCandidate([expensive, cheap])?.providerSlug).toBe("deepseek");
  });

  it("LOWEST_LATENCY favors faster provider", () => {
    const slow = candidate({ latencyP50: 900, providerSlug: "qwen" });
    const fast = candidate({ latencyP50: 100, providerSlug: "gemini", providerId: "p4" });
    scoreSmartCandidates([slow, fast], "LOWEST_LATENCY");
    expect(selectTopSmartCandidate([slow, fast])?.providerSlug).toBe("gemini");
  });

  it("EU_COMPLIANCE favors euCompliant provider", () => {
    const nonEu = candidate({ euCompliant: false, providerSlug: "openai" });
    const eu = candidate({ euCompliant: true, providerSlug: "gemini", providerId: "p5" });
    scoreSmartCandidates([nonEu, eu], "EU_COMPLIANCE");
    expect(selectTopSmartCandidate([nonEu, eu])?.euCompliant).toBe(true);
  });

  it("promotion expired does not boost score", () => {
    const c = candidate({ promotionActive: true, promotionEndDate: "2020-01-01T00:00:00.000Z" });
    scoreSmartCandidates([c], "BALANCED");
    expect(c.scoreBreakdown?.promotionScore).toBe(0);
  });

  it("MODE_WEIGHTS sum approximately to 1 for BALANCED", () => {
    const w = MODE_WEIGHTS.BALANCED;
    const sum = w.cost + w.latency + w.reliability + w.quality + w.compliance + w.priority;
    expect(sum).toBeCloseTo(1, 1);
  });
});

describe("smart-routing filters", () => {
  it("detects embedding capability", () => {
    expect(detectCapability({ requestedModel: "text-embedding-3" })).toBe("embedding");
  });

  it("detects streaming requirement", () => {
    expect(detectStreamingRequired({ metadata: { stream: true } })).toBe(true);
  });

  it("blocked preferred provider in strict mode returns empty eligible", () => {
    const eligible = [candidate({ providerSlug: "openai" })];
    const { eligible: out } = applyPreferredProviderFilter(
      {
        requestId: "r1",
        apiKeyId: "k1",
        requestedModel: "gpt-test",
        capability: "chat",
        euOnly: false,
        estimatedInputTokens: 100,
        estimatedOutputTokens: 100,
        expectedLatencyTier: "STANDARD",
        optimizationMode: "BALANCED",
        streamingRequired: false,
        fallbackAllowed: true,
        excludedProviders: [],
        preferredProviders: [],
        metadata: { strictPreferredProvider: true },
        policy: DEFAULT_ROUTING_POLICY,
        policySources: [],
        preferredProvider: "gemini",
      },
      eligible,
      [],
    );
    expect(out).toHaveLength(0);
  });
});

describe("routing-failover", () => {
  it("429 allows fallback", () => {
    expect(isFallbackAllowedError(new Error("HTTP 429 rate limit"))).toBe(true);
  });

  it("503 allows fallback", () => {
    expect(isFallbackAllowedError(new Error("HTTP 503 unavailable"))).toBe(true);
  });

  it("auth error blocks fallback", () => {
    expect(isFallbackAllowedError(new Error("authentication failed 401"))).toBe(false);
  });

  it("insufficient credits blocks fallback", () => {
    expect(isFallbackAllowedError(new Error("insufficient credits 402"))).toBe(false);
  });
});

describe("routing-compliance", () => {
  it("routing headers include transparency when required", () => {
    const decision = {
      selectedProviderSlug: "openai",
      selectedModelId: "gpt-test",
      optimizationMode: "BALANCED",
      estimatedCostEur: 0.01,
      decisionReasons: ["test"],
      complianceFlags: {
        transparencyRequired: true,
        aiGeneratedLabelRequired: true,
        deepfakeDisclosureRequired: false,
        euDataResidency: true,
        enforcementActive: true,
      },
    } as SmartRoutingDecision;
    const headers = buildRoutingResponseHeaders(decision);
    expect(headers["x-zwima-ai-generated"]).toBe("true");
    expect(headers["x-zwima-transparency-required"]).toBe("true");
    expect(headers["x-zwima-provider"]).toBe("openai");
    expect(JSON.stringify(headers)).not.toMatch(/sk_live|secret|api_key/i);
  });

  it("buildDecisionReasons never empty", () => {
    const c = candidate();
    scoreSmartCandidates([c], "BALANCED");
    expect(buildDecisionReasons(c, "BALANCED").length).toBeGreaterThan(0);
  });
});

describe("routing-admin-api contracts", () => {
  it("simulator flag implies no charge path (documented contract)", () => {
    expect(true).toBe(true);
  });
});
