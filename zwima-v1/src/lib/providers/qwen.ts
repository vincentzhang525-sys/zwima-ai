import { estimateCredits } from "./pricing";
import { extractSystemMessage, openAiCompatibleChat, parseOpenAiResponse } from "./http";
import type { ChatRequest, ChatResult, HealthResult, ModelInfo, ProviderAdapter } from "./types";

const MODELS: ModelInfo[] = [
  { id: "qwen-plus", provider: "qwen", name: "Qwen Plus" },
  { id: "qwen-max", provider: "qwen", name: "Qwen Max" },
];

const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

function apiKey(): string | null {
  return process.env.QWEN_API_KEY || null;
}

export const qwenAdapter: ProviderAdapter = {
  slug: "qwen",
  name: "Qwen",

  models() {
    return MODELS;
  },

  estimateCost(inputTokens, outputTokens, model) {
    return estimateCredits(inputTokens, outputTokens, model);
  },

  async health(): Promise<HealthResult> {
    const key = apiKey();
    if (!key) return { status: "unconfigured", latencyMs: null, error: "QWEN_API_KEY not set" };

    try {
      const { latencyMs, status, data } = await openAiCompatibleChat(BASE_URL, key, {
        model: "qwen-plus",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      if (status >= 400) {
        const msg = data.error?.message || `HTTP ${status}`;
        return { status: "error", latencyMs, error: msg };
      }
      return { status: "ok", latencyMs, error: null };
    } catch (err) {
      return { status: "error", latencyMs: null, error: err instanceof Error ? err.message : "Health check failed" };
    }
  },

  async chat(request: ChatRequest): Promise<ChatResult> {
    const key = apiKey();
    if (!key) throw new Error("QWEN_API_KEY not configured");

    const model = MODELS.find((m) => m.id === request.model)?.id ?? request.model;
    const { system, chatMessages } = extractSystemMessage(request.messages);
    const messages = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...chatMessages,
    ];

    const { data, latencyMs, status } = await openAiCompatibleChat(BASE_URL, key, {
      model,
      messages,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
    });

    if (status >= 400) {
      throw new Error(data.error?.message || `Qwen API error ${status}`);
    }

    return parseOpenAiResponse(data, model, "qwen", latencyMs);
  },
};
