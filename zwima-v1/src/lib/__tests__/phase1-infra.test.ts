import { describe, it, expect, vi } from "vitest";
import { scoreCandidates, selectTopCandidate } from "@/lib/routing/scoring-engine";
import { executeWithFallback } from "@/lib/routing/fallback-engine";
import type { RoutingCandidate, RoutingDecision } from "@/lib/routing/routing-types";
import { hashContent } from "@/lib/audit/ai-audit";
import {
  maskKeyPrefix,
  validateApiKeyState,
  checkProviderAllowed,
  checkModelAllowed,
  checkRateLimit,
  checkTpmLimit,
  checkIpWhitelist,
  checkPermission,
  checkBudget,
} from "@/lib/api-keys/governance";
import { clampOutputTokens, MarginGuardError, checkMarginProtection } from "@/lib/cost/margin-guard";
import { ApiError } from "@/lib/api-errors";
import { RoutingError } from "@/lib/routing/routing-errors";
import { serializeKey } from "@/lib/api-keys/service";
import type { ApiKey } from "@prisma/client";

const weights = { costWeight: 0.3, latencyWeight: 0.25, qualityWeight: 0.2, reliabilityWeight: 0.15, regionWeight: 0.1 };

const baseCandidate = (overrides: Partial<RoutingCandidate>): RoutingCandidate => ({
  providerSlug: "openai",
  providerId: "p1",
  modelCode: "gpt-5",
  providerModelId: "m1",
  displayName: "GPT-5",
  qualityTier: "STANDARD",
  estimatedProviderCostEur: 0.01,
  estimatedCustomerCharge: 15,
  estimatedMarginPercent: 30,
  healthStatus: "HEALTHY",
  ...overrides,
});

const mockKey = (overrides: Partial<ApiKey> = {}): ApiKey & { user: { id: string; tier: string; creditBalance: null }; organization: null } => ({
  id: "k1",
  userId: "u1",
  organizationId: "org1",
  name: "test",
  keyHash: "hash",
  prefix: "sk_live_abc…",
  enabled: true,
  status: "ACTIVE",
  permission: "FULL",
  permissions: [],
  ipWhitelist: null,
  usageLimit: null,
  usageCount: 0,
  rpmLimit: null,
  tpmLimit: null,
  dailyBudget: null,
  monthlyBudget: null,
  currentMonthUsage: 0,
  currentMonthStart: null,
  allowedProviders: [],
  allowedModels: [],
  environment: "production",
  metadata: null,
  expiresAt: null,
  revokedAt: null,
  revokedById: null,
  revokeReason: null,
  createdAt: new Date(),
  lastUsed: null,
  user: { id: "u1", tier: "STANDARD", creditBalance: null },
  organization: null,
  ...overrides,
});

describe("routing scoring", () => {
  it("LOWEST_COST selects cheapest provider", () => {
    const candidates = [
      baseCandidate({ providerSlug: "openai", estimatedProviderCostEur: 0.05 }),
      baseCandidate({ providerSlug: "deepseek", estimatedProviderCostEur: 0.01 }),
    ];
    scoreCandidates(candidates, "LOWEST_COST", weights);
    expect(selectTopCandidate(candidates)?.providerSlug).toBe("deepseek");
  });

  it("BALANCED uses configurable weights", () => {
    const candidates = [
      baseCandidate({ providerSlug: "a", estimatedProviderCostEur: 0.01, latencyP50: 500 }),
      baseCandidate({ providerSlug: "b", estimatedProviderCostEur: 0.05, latencyP50: 50 }),
    ];
    scoreCandidates(candidates, "BALANCED", { costWeight: 0.1, latencyWeight: 0.7, qualityWeight: 0.1, reliabilityWeight: 0.05, regionWeight: 0.05 });
    expect(selectTopCandidate(candidates)?.providerSlug).toBe("b");
  });

  it("excludes disabled candidates", () => {
    const candidates = [
      baseCandidate({ excluded: true, exclusionReason: "down" }),
      baseCandidate({ providerSlug: "gemini" }),
    ];
    scoreCandidates(candidates, "BALANCED", weights);
    expect(selectTopCandidate(candidates)?.providerSlug).toBe("gemini");
  });

  it("EU_PREFERRED favors region match", () => {
    const candidates = [
      baseCandidate({ providerSlug: "us", region: "US", dataResidency: "US", estimatedProviderCostEur: 0.01 }),
      baseCandidate({ providerSlug: "eu", region: "EU", dataResidency: "EU", estimatedProviderCostEur: 0.02 }),
    ];
    scoreCandidates(candidates, "EU_PREFERRED", weights, "EU");
    expect(selectTopCandidate(candidates)?.providerSlug).toBe("eu");
  });
});

describe("fallback engine", () => {
  it("returns chargedOnce true on success", async () => {
    const decision: RoutingDecision = {
      selected: baseCandidate({ providerSlug: "only" }),
      candidates: [baseCandidate({ providerSlug: "only" })],
      excluded: [],
      strategy: "MODEL_PINNED",
      routingReason: "pinned",
      estimatedCost: 0.01,
      estimatedCustomerCharge: 5,
      estimatedMarginPercent: 40,
      fallbackCount: 0,
      attemptedProviders: [],
    };

    const registry = await import("@/lib/providers/registry");
    vi.spyOn(registry, "getAdapter").mockReturnValue({
      slug: "only",
      name: "only",
      chat: async () => ({ content: "x", model: "m", provider: "only", inputTokens: 1, outputTokens: 1, latencyMs: 5 }),
      models: () => [],
      health: async () => ({ status: "ok", latencyMs: 1, error: null }),
      estimateCost: () => 1,
    });

    const result = await executeWithFallback({
      decision,
      candidates: decision.candidates,
      messages: [{ role: "user", content: "hi" }],
      maxRetries: 0,
    });
    expect(result.chargedOnce).toBe(true);
    expect(result.result.content).toBe("x");
  });
});

describe("cost and margin", () => {
  it("clamps output tokens", () => {
    process.env.MAX_ESTIMATED_OUTPUT_TOKENS = "2048";
    expect(clampOutputTokens(99999)).toBe(2048);
  });

  it("MarginGuardError has correct name", () => {
    expect(new MarginGuardError("low").name).toBe("MarginGuardError");
  });
});

describe("api key governance", () => {
  it("rejects expired key", () => {
    const key = mockKey({ expiresAt: new Date("2020-01-01"), status: "ACTIVE" });
    expect(() => validateApiKeyState(key)).toThrow(ApiError);
  });

  it("rejects revoked key", () => {
    const key = mockKey({ status: "REVOKED", enabled: false });
    expect(() => validateApiKeyState(key)).toThrow(ApiError);
  });

  it("enforces provider allowlist", () => {
    const key = mockKey({ allowedProviders: ["openai"] });
    expect(() => checkProviderAllowed(key, "gemini")).toThrow(ApiError);
  });

  it("enforces model allowlist", () => {
    const key = mockKey({ allowedModels: ["gpt-5"] });
    expect(() => checkModelAllowed(key, "claude-sonnet")).toThrow(ApiError);
  });

  it("enforces rpm limit", () => {
    const key = mockKey({ rpmLimit: 2 });
    checkRateLimit(key);
    checkRateLimit(key);
    expect(() => checkRateLimit(key)).toThrow(ApiError);
  });

  it("enforces tpm limit", () => {
    const key = mockKey({ id: "tpm-key-1", tpmLimit: 100 });
    checkTpmLimit(key, 50);
    expect(() => checkTpmLimit(key, 60)).toThrow(ApiError);
  });

  it("enforces ip whitelist", () => {
    const key = mockKey({ ipWhitelist: "1.2.3.4" });
    expect(() => checkIpWhitelist(key, "5.6.7.8")).toThrow(ApiError);
  });

  it("masks key prefix", () => {
    expect(maskKeyPrefix("sk_live_abcdef123456")).toContain("…");
  });
});

describe("audit", () => {
  it("hashes content without storing plaintext", () => {
    const hash = hashContent("secret prompt with sk_live_abc123");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("secret");
    expect(hash).not.toContain("sk_live");
  });
});

describe("routing edge cases", () => {
  it("returns null when all candidates excluded", () => {
    const candidates = [
      baseCandidate({ providerSlug: "openai", excluded: true, exclusionReason: "disabled" }),
      baseCandidate({ providerSlug: "claude", excluded: true, exclusionReason: "no pricing" }),
    ];
    expect(selectTopCandidate(candidates)).toBeNull();
  });

  it("RoutingError uses ROUTING_FAILED code", () => {
    const err = new RoutingError("No providers");
    expect(err.code).toBe("ROUTING_FAILED");
    expect(err.status).toBe(503);
  });
});

describe("fallback retry limits", () => {
  it("throws after exhausting maxRetries", async () => {
    const decision: RoutingDecision = {
      selected: baseCandidate({ providerSlug: "a", modelCode: "m1" }),
      candidates: [baseCandidate({ providerSlug: "b", modelCode: "m2" })],
      excluded: [],
      strategy: "BALANCED",
      routingReason: "test",
      estimatedCost: 0.01,
      estimatedCustomerCharge: 5,
      estimatedMarginPercent: 40,
      fallbackCount: 0,
      attemptedProviders: [],
    };

    const registry = await import("@/lib/providers/registry");
    vi.spyOn(registry, "getAdapter").mockImplementation(() => ({
      slug: "fail",
      name: "fail",
      chat: async () => {
        throw new Error("provider down");
      },
      models: () => [],
      health: async () => ({ status: "error", latencyMs: 1, error: "down" }),
      estimateCost: () => 1,
    }));

    await expect(
      executeWithFallback({
        decision,
        candidates: decision.candidates,
        messages: [{ role: "user", content: "hi" }],
        maxRetries: 0,
        fallbackEnabled: true,
      })
    ).rejects.toThrow("provider down");
  });
});

describe("cost and margin protection", () => {
  it("rejects estimates below minimum margin", async () => {
    vi.stubEnv("MIN_MARGIN_PERCENT", "20");
    const prismaMod = await import("@/lib/prisma");
    const createSpy = vi.spyOn(prismaMod.prisma.securityEvent, "create").mockResolvedValue({} as never);

    await expect(
      checkMarginProtection({
        providerCostEur: 1,
        customerChargeCredits: 100,
        platformMarginEur: 0.05,
        marginPercent: 5,
        inputTokens: 100,
        outputTokens: 100,
        currency: "EUR",
        exchangeRate: 1,
      })
    ).rejects.toBeInstanceOf(MarginGuardError);

    expect(createSpy).toHaveBeenCalled();
    createSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe("api key governance extended", () => {
  it("rejects disabled key", () => {
    const key = mockKey({ status: "DISABLED", enabled: false });
    expect(() => validateApiKeyState(key)).toThrow(ApiError);
  });

  it("enforces permission scope", () => {
    const key = mockKey({ permission: "READ", permissions: ["READ"] });
    expect(() => checkPermission(key, "CHAT")).toThrow(ApiError);
  });

  it("allows FULL permission for chat", () => {
    const key = mockKey({ permission: "FULL", permissions: ["FULL"] });
    expect(() => checkPermission(key, "CHAT")).not.toThrow();
  });

  it("enforces monthly budget", async () => {
    const prismaMod = await import("@/lib/prisma");
    vi.spyOn(prismaMod.prisma.apiKey, "update").mockResolvedValue({} as never);
    const key = mockKey({ id: "budget-key", monthlyBudget: 100, currentMonthUsage: 95, currentMonthStart: new Date() });
    await expect(checkBudget(key, 10)).rejects.toThrow(ApiError);
  });

  it("serializeKey never returns full key material", () => {
    const row = serializeKey({
      id: "k1",
      name: "prod",
      prefix: "sk_live_abcdefghijklmnop",
      enabled: true,
      status: "ACTIVE",
      permission: "FULL",
      usageCount: 0,
      expiresAt: null,
      createdAt: new Date(),
      lastUsed: null,
    });
    expect(row.prefix).not.toContain("klmnop");
    expect(row.prefix).toContain("…");
  });
});

describe("billing consistency", () => {
  it("fallback success marks chargedOnce true (single billing intent)", async () => {
    const decision: RoutingDecision = {
      selected: baseCandidate({ providerSlug: "only", modelCode: "m" }),
      candidates: [],
      excluded: [],
      strategy: "MODEL_PINNED",
      routingReason: "pinned",
      estimatedCost: 0.01,
      estimatedCustomerCharge: 5,
      estimatedMarginPercent: 40,
      fallbackCount: 0,
      attemptedProviders: [],
    };

    const registry = await import("@/lib/providers/registry");
    vi.spyOn(registry, "getAdapter").mockReturnValue({
      slug: "only",
      name: "only",
      chat: async () => ({ content: "ok", model: "m", provider: "only", inputTokens: 10, outputTokens: 5, latencyMs: 12 }),
      models: () => [],
      health: async () => ({ status: "ok", latencyMs: 1, error: null }),
      estimateCost: () => 1,
    });

    const result = await executeWithFallback({
      decision,
      candidates: [],
      messages: [{ role: "user", content: "bill once" }],
    });
    expect(result.chargedOnce).toBe(true);
  });
});
