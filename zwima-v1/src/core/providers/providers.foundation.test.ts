import { describe, expect, it, beforeEach } from "vitest";
import {
  bootstrapDefaultProviders,
  clearHealthRecords,
  clearModelRegistry,
  clearProviderRegistry,
  getModel,
  getProvider,
  listAllModels,
  listEuCompliantModels,
  listProviderIds,
  listProviderRegistryEntries,
  listProviders,
  modelRegistrySize,
  providerRegistrySize,
  requireProvider,
  runAllProviderHealthChecks,
} from "@/core/providers";

describe("Phase 5 Module 1 — Provider Foundation", () => {
  beforeEach(() => {
    clearProviderRegistry();
    clearModelRegistry();
    clearHealthRecords();
    bootstrapDefaultProviders();
  });

  it("registers all five providers", () => {
    expect(providerRegistrySize()).toBe(5);
    expect(listProviderIds().sort()).toEqual(["claude", "deepseek", "gemini", "openai", "qwen"]);
  });

  it("orders providers by priority descending", () => {
    const ids = listProviders().map((p) => p.id);
    expect(ids[0]).toBe("gemini");
    expect(ids).toContain("openai");
    expect(ids).toContain("qwen");
  });

  it("registers models into global model registry", () => {
    expect(modelRegistrySize()).toBeGreaterThanOrEqual(10);
    expect(getModel("gpt-5")?.provider).toBe("openai");
    expect(getModel("gemini-2.5-flash")?.provider).toBe("gemini");
  });

  it("lists EU compliant models", () => {
    const eu = listEuCompliantModels();
    expect(eu.some((m) => m.modelId === "gpt-5")).toBe(true);
    expect(eu.some((m) => m.modelId === "deepseek-chat")).toBe(false);
  });

  it("returns unified registry entries with health snapshots", async () => {
    const entries = await listProviderRegistryEntries();
    expect(entries).toHaveLength(5);
    for (const entry of entries) {
      expect(entry.displayName).toBeTruthy();
      expect(entry.supportedFeatures.length).toBeGreaterThan(0);
      expect(entry.health).toBeDefined();
      expect(typeof entry.health.online).toBe("boolean");
    }
  });

  it("chat returns unified response shape (stub)", async () => {
    const openai = requireProvider("openai");
    const res = await openai.chat({
      model: "gpt-5",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(res.provider).toBe("openai");
    expect(res.model).toBe("gpt-5");
    expect(res.content).toContain("[openai]");
    expect(res.usage.totalTokens).toBeGreaterThan(0);
    expect(res.finishReason).toBe("stop");
  });

  it("streamChat yields chunks then done", async () => {
    const gemini = getProvider("gemini")!;
    const chunks = [];
    for await (const chunk of gemini.streamChat({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "Hi" }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)?.done).toBe(true);
    expect(chunks.at(-1)?.usage?.totalTokens).toBeGreaterThan(0);
  });

  it("embeddings returns vector payload (stub)", async () => {
    const openai = requireProvider("openai");
    const res = await openai.embeddings({ model: "text-embedding-3-large", input: "test" });
    expect(res.vectors).toHaveLength(1);
    expect(res.dimensions).toBe(8);
  });

  it("rejects unsupported features per provider", async () => {
    const deepseek = requireProvider("deepseek");
    await expect(deepseek.embeddings({ model: "deepseek-chat", input: "x" })).rejects.toThrow(/not supported/);
  });

  it("estimateCost uses model pricing metadata", async () => {
    const claude = requireProvider("claude");
    const cost = await claude.estimateCost({ model: "claude-sonnet-4", inputTokens: 1_000_000, outputTokens: 500_000 });
    expect(cost.totalCostUsd).toBeGreaterThan(0);
    expect(cost.provider).toBe("claude");
  });

  it("normalizeUsage handles OpenAI-style payloads", () => {
    const qwen = requireProvider("qwen");
    const usage = qwen.normalizeUsage({ prompt_tokens: 100, completion_tokens: 50 });
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
  });

  it("normalizeError maps retryable codes", () => {
    const openai = requireProvider("openai");
    const err = openai.normalizeError(new Error("rate limit exceeded"));
    expect(err.code).toBe("rate_limited");
    expect(err.retryable).toBe(true);
    expect(err.provider).toBe("openai");
  });

  it("runAllProviderHealthChecks returns five snapshots", async () => {
    const snapshots = await runAllProviderHealthChecks(listProviders());
    expect(snapshots).toHaveLength(5);
    expect(snapshots.every((s) => s.status === "ONLINE" || s.status === "UNCONFIGURED")).toBe(true);
  });

  it("listAllModels includes every provider catalog", () => {
    const all = listAllModels();
    const providers = new Set(all.map((m) => m.provider));
    expect(providers).toEqual(new Set(["claude", "deepseek", "gemini", "openai", "qwen"]));
  });
});
