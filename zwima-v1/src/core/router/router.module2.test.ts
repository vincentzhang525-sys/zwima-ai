import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  bootstrapUnifiedAdapters,
  clearUnifiedAdapters,
} from "@/core/adapters";
import { clearAllCoreCaches } from "@/core/cache";
import { clearMonthlyUsage, calculateTokenCost, loadPricingQuotes } from "@/core/cost";
import { clearHealthEngineState, recordFailure, recordSuccess, runHealthChecks } from "@/core/health";
import {
  bootstrapDefaultProviders,
  clearModelRegistry,
  clearProviderRegistry,
  clearHealthRecords,
} from "@/core/providers";
import {
  buildRoutingCandidates,
  resolveRoutingDecision,
  routingEngine,
  RoutingError,
  shouldRetry,
  retryDelayMs,
  applyRegionPolicy,
  modelSupportsCapability,
  getProviderHealthScore,
} from "@/core/router";
import {
  ensureCoreGateway,
  gatewayChat,
  gatewayEmbeddings,
  gatewayHealth,
  gatewayModels,
  gatewayPricing,
  gatewayProviders,
  gatewayRoutingPreview,
  resetCoreGateway,
} from "@/core/api";

function resetAll() {
  resetCoreGateway();
  clearUnifiedAdapters();
  clearProviderRegistry();
  clearModelRegistry();
  clearHealthRecords();
  clearAllCoreCaches();
  clearHealthEngineState();
  clearMonthlyUsage();
}

describe("Phase 5 Module 2 — Smart Routing Engine", () => {
  beforeEach(() => {
    resetAll();
    bootstrapDefaultProviders();
    bootstrapUnifiedAdapters();
  });

  afterEach(() => {
    resetAll();
  });

  describe("Unit — Provider Adapters", () => {
    it("registers five unified adapters", async () => {
      ensureCoreGateway();
      const providers = await gatewayProviders();
      expect(providers).toHaveLength(5);
      for (const p of providers) {
        expect(p.adapterRegistered).toBe(true);
      }
    });

    it("returns pricing for all providers", () => {
      ensureCoreGateway();
      const quotes = gatewayPricing();
      expect(quotes.length).toBeGreaterThan(10);
      const providers = new Set(quotes.map((q) => q.provider));
      expect(providers.size).toBe(5);
    });
  });

  describe("Unit — Capability & Region", () => {
    it("resolves embedding capability", () => {
      expect(
        modelSupportsCapability(
          {
            streaming: false,
            embedding: true,
            vision: false,
            functionCalling: false,
            image: false,
            audio: false,
            video: false,
          },
          "embeddings",
        ),
      ).toBe(true);
    });

    it("blocks non-EU models under EU policy", () => {
      const result = applyRegionPolicy("deepseek", "deepseek-chat", {
        capability: "chat",
        region: "EU",
        requireEuCompliance: true,
      });
      expect(result.allowed).toBe(false);
    });

    it("boosts EU-preferred providers", () => {
      const result = applyRegionPolicy("gemini", "gemini-2.5-flash", {
        capability: "chat",
        region: "EU",
        requireEuCompliance: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.scoreBoost).toBeGreaterThan(0);
    });
  });

  describe("Routing — Model selection", () => {
    it("selects gemini flash by default", () => {
      const decision = resolveRoutingDecision({ capability: "chat", model: "gemini-2.5-flash" });
      expect(decision.selected.provider).toBe("gemini");
      expect(decision.selected.model).toBe("gemini-2.5-flash");
      expect(decision.selected.score).toBeGreaterThan(0);
    });

    it("builds fallback chain", () => {
      const decision = resolveRoutingDecision({ capability: "chat" });
      expect(decision.fallbackChain.length).toBeGreaterThan(0);
    });

    it("respects explicit provider filter", () => {
      const candidates = buildRoutingCandidates({ capability: "chat", provider: "claude" });
      expect(candidates.every((c) => c.provider === "claude")).toBe(true);
    });
  });

  describe("Integration — Chat execution", () => {
    it("routes chat through engine", async () => {
      const result = await routingEngine.chat(
        { capability: "chat", model: "gpt-5" },
        { messages: [{ role: "user", content: "Hello" }] },
        "req_test_1",
      );
      expect(result.provider).toBe("openai");
      expect(result.content).toContain("[openai]");
      expect(result.cost.totalCostUsd).toBeGreaterThanOrEqual(0);
    });

    it("gateway chat returns unified shape", async () => {
      const result = await gatewayChat(
        {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: "Hi" }],
        },
        "req_gateway_1",
      );
      expect(result.requestId).toBe("req_gateway_1");
      expect(result.routing.reasons.length).toBeGreaterThan(0);
    });
  });

  describe("Integration — Embeddings", () => {
    it("routes embeddings to embedding-capable model", async () => {
      const result = await gatewayEmbeddings(
        { model: "text-embedding-3-large", input: "hello world" },
        "req_embed_1",
      );
      expect(result.provider).toBe("openai");
      expect(result.vectors.length).toBeGreaterThan(0);
    });
  });

  describe("Failover — Provider switch", () => {
    it("retries according to policy", () => {
      expect(shouldRetry(1)).toBe(true);
      expect(shouldRetry(3)).toBe(false);
      expect(retryDelayMs(2)).toBeGreaterThan(retryDelayMs(1));
    });

    it("prefers healthy providers", async () => {
      recordFailure("deepseek");
      recordFailure("deepseek");
      recordFailure("deepseek");
      recordSuccess("gemini", 100);
      recordSuccess("gemini", 100);
      await runHealthChecks();
      const healthy = getProviderHealthScore("gemini");
      const unhealthy = getProviderHealthScore("deepseek");
      expect(healthy).toBeGreaterThan(unhealthy);
    });
  });

  describe("Cost — Token calculator", () => {
    it("calculates cost for all five providers", () => {
      ensureCoreGateway();
      loadPricingQuotes();
      for (const provider of ["openai", "gemini", "claude", "deepseek", "qwen"] as const) {
        const cost = calculateTokenCost({
          provider,
          model: provider === "openai" ? "gpt-5" : provider === "gemini" ? "gemini-2.5-flash" : provider === "claude" ? "claude-sonnet-4" : provider === "deepseek" ? "deepseek-chat" : "qwen-max",
          inputTokens: 1000,
          outputTokens: 500,
        });
        expect(cost.totalCostUsd).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Health — Monitor", () => {
    it("returns health metrics for providers", async () => {
      const metrics = await gatewayHealth(true);
      expect(metrics).toHaveLength(5);
      for (const m of metrics) {
        expect(typeof m.online).toBe("boolean");
        expect(typeof m.errorRate).toBe("number");
      }
    });
  });

  describe("Cache — Models & pricing", () => {
    it("caches model catalog", () => {
      const first = gatewayModels();
      const second = gatewayModels();
      expect(first.length).toBe(second.length);
      expect(first.length).toBeGreaterThan(10);
    });
  });

  describe("Routing preview", () => {
    it("throws when no candidates match", () => {
      expect(() =>
        resolveRoutingDecision({ capability: "chat", model: "nonexistent-model-xyz" }),
      ).toThrow(RoutingError);
    });

    it("gateway preview returns decision", () => {
      const decision = gatewayRoutingPreview({ capability: "chat", model: "gpt-5" }, "req_preview");
      expect(decision.selected.model).toBe("gpt-5");
    });
  });

  describe("Stress — concurrent routing", () => {
    it("handles 50 concurrent routing decisions", async () => {
      const tasks = Array.from({ length: 50 }, (_, i) =>
        gatewayChat(
          { model: "gemini-2.5-flash", messages: [{ role: "user", content: `msg ${i}` }] },
          `req_stress_${i}`,
        ),
      );
      const results = await Promise.all(tasks);
      expect(results).toHaveLength(50);
      expect(results.every((r) => r.provider === "gemini")).toBe(true);
    });
  });
});
