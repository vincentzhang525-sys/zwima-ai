import { randomUUID } from "crypto";
import type { ProviderAdapter as LegacyAdapter } from "@/lib/providers/types";
import { getAdapter } from "@/lib/providers/registry";
import {
  assertLiveProviderHttpAllowed,
  isLiveProviderHttpAllowed,
  PROVIDER_LIVE_CALLS_DISABLED,
} from "@/lib/providers/live-provider-gate";
import { listModelsByProvider, getModel } from "@/core/providers/model-registry";
import { requireProvider } from "@/core/providers";
import type { ProviderId } from "@/core/providers/types";
import type {
  AdapterChatRequest,
  AdapterChatResponse,
  AdapterEmbeddingsRequest,
  AdapterEmbeddingsResponse,
  AdapterHealthResult,
  AdapterModelInfo,
  AdapterPricingQuote,
  AdapterStreamChunk,
  UnifiedProviderAdapter,
} from "./types";

function configured(provider: ProviderId): boolean {
  const envMap: Record<ProviderId, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    qwen: process.env.QWEN_API_KEY,
  };
  const key = envMap[provider];
  return Boolean(key && !key.includes("placeholder"));
}

function legacyOrStub(provider: ProviderId): { mode: "legacy" | "stub"; legacy?: LegacyAdapter } {
  const legacy = getAdapter(provider);
  if (legacy && configured(provider)) return { mode: "legacy", legacy };
  return { mode: "stub" };
}

export class BridgeProviderAdapter implements UnifiedProviderAdapter {
  readonly id: ProviderId;

  constructor(id: ProviderId) {
    this.id = id;
  }

  async chat(request: AdapterChatRequest): Promise<AdapterChatResponse> {
    const bridge = legacyOrStub(this.id);
    if (bridge.mode === "legacy" && bridge.legacy) {
      // Fail-closed before any legacy HTTP adapter work.
      assertLiveProviderHttpAllowed();
      const result = await bridge.legacy.chat({
        model: request.model,
        messages: request.messages,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });
      return {
        id: randomUUID(),
        provider: this.id,
        model: result.model,
        content: result.content,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        finishReason: "stop",
      };
    }

    const res = await requireProvider(this.id).chat({ ...request, stream: false });
    return {
      id: res.id,
      provider: this.id,
      model: res.model,
      content: res.content,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      latencyMs: res.latencyMs,
      finishReason: res.finishReason === "length" ? "length" : "stop",
    };
  }

  async *stream(request: AdapterChatRequest): AsyncIterable<AdapterStreamChunk> {
    const bridge = legacyOrStub(this.id);
    if (bridge.mode === "legacy" && bridge.legacy) {
      assertLiveProviderHttpAllowed();
      const result = await bridge.legacy.chat({
        model: request.model,
        messages: request.messages,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });
      const id = randomUUID();
      for (let i = 0; i < result.content.length; i += 16) {
        yield {
          id,
          provider: this.id,
          model: result.model,
          delta: result.content.slice(i, i + 16),
          done: false,
        };
      }
      yield {
        id,
        provider: this.id,
        model: result.model,
        delta: "",
        done: true,
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      };
      return;
    }

    for await (const chunk of requireProvider(this.id).streamChat({ ...request, stream: true })) {
      yield {
        id: chunk.id,
        provider: this.id,
        model: chunk.model,
        delta: chunk.delta,
        done: chunk.done,
        usage: chunk.usage
          ? { inputTokens: chunk.usage.inputTokens, outputTokens: chunk.usage.outputTokens }
          : undefined,
      };
    }
  }

  async embeddings(request: AdapterEmbeddingsRequest): Promise<AdapterEmbeddingsResponse> {
    const res = await requireProvider(this.id).embeddings(request);
    return {
      id: res.id,
      provider: this.id,
      model: res.model,
      vectors: res.vectors,
      dimensions: res.dimensions,
      inputTokens: res.usage.inputTokens,
    };
  }

  models(): AdapterModelInfo[] {
    const catalog = listModelsByProvider(this.id);
    if (catalog.length > 0) {
      return catalog.map((m) => ({
        id: m.modelId,
        provider: m.provider,
        name: m.displayName,
        streaming: m.streaming,
        embedding: m.embedding,
        euCompliance: m.euCompliance,
      }));
    }

    const legacy = getAdapter(this.id);
    if (legacy) {
      return legacy.models().map((m) => ({
        id: m.id,
        provider: this.id,
        name: m.name,
        streaming: true,
        embedding: m.id.includes("embedding"),
        euCompliance: this.id === "openai" || this.id === "gemini" || this.id === "claude",
      }));
    }

    return [];
  }

  async health(): Promise<AdapterHealthResult> {
    if (!isLiveProviderHttpAllowed()) {
      return {
        provider: this.id,
        online: false,
        latencyMs: null,
        error: PROVIDER_LIVE_CALLS_DISABLED,
        configured: configured(this.id),
      };
    }
    const bridge = legacyOrStub(this.id);
    if (bridge.mode === "legacy" && bridge.legacy) {
      const h = await bridge.legacy.health();
      return {
        provider: this.id,
        online: h.status === "ok",
        latencyMs: h.latencyMs,
        error: h.error,
        configured: h.status !== "unconfigured",
      };
    }
    const h = await requireProvider(this.id).health();
    return {
      provider: this.id,
      online: h.online,
      latencyMs: h.latencyMs,
      error: h.message,
      configured: h.status !== "UNCONFIGURED",
    };
  }

  pricing(): AdapterPricingQuote[] {
    return listModelsByProvider(this.id).map((m) => ({
      provider: m.provider,
      model: m.modelId,
      inputCostPer1M: m.inputCostPer1M,
      outputCostPer1M: m.outputCostPer1M,
      currency: "USD",
    }));
  }
}

export function createBridgeAdapter(id: ProviderId): BridgeProviderAdapter {
  return new BridgeProviderAdapter(id);
}

export function modelExists(provider: ProviderId, modelId: string): boolean {
  return Boolean(getModel(modelId)?.provider === provider || getAdapter(provider)?.models().some((m) => m.id === modelId));
}
