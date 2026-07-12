import { estimateCredits } from "./pricing";
import { extractSystemMessage, fetchJson } from "./http";
import type { ChatRequest, ChatResult, HealthResult, ModelInfo, ProviderAdapter } from "./types";

const MODELS: ModelInfo[] = [
  { id: "gemini-2.5-pro", provider: "gemini", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", provider: "gemini", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", provider: "gemini", name: "Gemini 2.5 Flash Lite" },
];

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; code?: number };
};

function apiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

function buildContents(messages: ChatRequest["messages"]) {
  const { system, chatMessages } = extractSystemMessage(messages);
  const contents = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  return {
    contents,
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
  };
}

export const geminiAdapter: ProviderAdapter = {
  slug: "gemini",
  name: "Gemini",

  models() {
    return MODELS;
  },

  estimateCost(inputTokens, outputTokens, model) {
    return estimateCredits(inputTokens, outputTokens, model);
  },

  async health(): Promise<HealthResult> {
    const key = apiKey();
    if (!key) return { status: "unconfigured", latencyMs: null, error: "GEMINI_API_KEY not set" };

    const model = MODELS[0].id;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${key}`;
    try {
      const { latencyMs, status, data } = await fetchJson<{ name?: string; error?: { message?: string } }>(url);
      if (status >= 400) {
        return { status: "error", latencyMs, error: data.error?.message || `HTTP ${status}` };
      }
      return { status: "ok", latencyMs, error: null };
    } catch (err) {
      return { status: "error", latencyMs: null, error: err instanceof Error ? err.message : "Health check failed" };
    }
  },

  async chat(request: ChatRequest): Promise<ChatResult> {
    const key = apiKey();
    if (!key) throw new Error("GEMINI_API_KEY not configured");

    const model = MODELS.find((m) => m.id === request.model)?.id ?? request.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const { contents, systemInstruction } = buildContents(request.messages);

    const { data, latencyMs, status } = await fetchJson<GeminiResponse>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
        },
      }),
    });

    if (status >= 400 || data.error) {
      throw new Error(data.error?.message || `Gemini API error ${status}`);
    }

    const content =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";

    return {
      content,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      model,
      provider: "gemini",
      latencyMs,
    };
  },
};
