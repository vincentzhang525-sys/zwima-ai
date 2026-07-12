import { estimateCredits } from "./pricing";
import { extractSystemMessage, openAiCompatibleChat, parseOpenAiResponse } from "./http";
import type { ChatRequest, ChatResult, HealthResult, ModelInfo, ProviderAdapter } from "./types";

const MODELS: ModelInfo[] = [
  { id: "gpt-5", provider: "openai", name: "GPT-5" },
  { id: "gpt-5-mini", provider: "openai", name: "GPT-5 Mini" },
  { id: "gpt-5-nano", provider: "openai", name: "GPT-5 Nano" },
];

const BASE_URL = "https://api.openai.com/v1";

function apiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

export const openaiAdapter: ProviderAdapter = {
  slug: "openai",
  name: "OpenAI",

  models() {
    return MODELS;
  },

  estimateCost(inputTokens, outputTokens, model) {
    return estimateCredits(inputTokens, outputTokens, model);
  },

  async health(): Promise<HealthResult> {
    const key = apiKey();
    if (!key) return { status: "unconfigured", latencyMs: null, error: "OPENAI_API_KEY not set" };

    try {
      const { latencyMs, status, data } = await openAiCompatibleChat(BASE_URL, key, {
        model: MODELS[0].id,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      if (status >= 400) {
        const msg = (data as { error?: { message?: string } }).error?.message || `HTTP ${status}`;
        return { status: "error", latencyMs, error: msg };
      }
      return { status: "ok", latencyMs, error: null };
    } catch (err) {
      return { status: "error", latencyMs: null, error: err instanceof Error ? err.message : "Health check failed" };
    }
  },

  async chat(request: ChatRequest): Promise<ChatResult> {
    const key = apiKey();
    if (!key) throw new Error("OPENAI_API_KEY not configured");

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
      throw new Error(data.error?.message || `OpenAI API error ${status}`);
    }

    return parseOpenAiResponse(data, model, "openai", latencyMs);
  },
};
