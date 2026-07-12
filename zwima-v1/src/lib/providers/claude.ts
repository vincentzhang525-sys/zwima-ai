import { estimateCredits } from "./pricing";
import { extractSystemMessage, fetchJson } from "./http";
import type { ChatRequest, ChatResult, HealthResult, ModelInfo, ProviderAdapter } from "./types";

const MODELS: ModelInfo[] = [
  { id: "claude-sonnet", provider: "claude", name: "Claude Sonnet" },
  { id: "claude-opus", provider: "claude", name: "Claude Opus" },
];

/** Map public model IDs to Anthropic API model names. */
const MODEL_MAP: Record<string, string> = {
  "claude-sonnet": "claude-sonnet-4-20250514",
  "claude-opus": "claude-opus-4-20250514",
};

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

function apiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

function resolveModel(model: string): string {
  return MODEL_MAP[model.toLowerCase()] ?? model;
}

export const claudeAdapter: ProviderAdapter = {
  slug: "claude",
  name: "Claude",

  models() {
    return MODELS;
  },

  estimateCost(inputTokens, outputTokens, model) {
    return estimateCredits(inputTokens, outputTokens, model);
  },

  async health(): Promise<HealthResult> {
    const key = apiKey();
    if (!key) return { status: "unconfigured", latencyMs: null, error: "ANTHROPIC_API_KEY not set" };

    try {
      const { latencyMs, status, data } = await fetchJson<{ data?: unknown[]; error?: { message?: string } }>(
        "https://api.anthropic.com/v1/models",
        {
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
        }
      );
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
    if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

    const publicModel = MODELS.find((m) => m.id === request.model)?.id ?? request.model;
    const apiModel = resolveModel(publicModel);
    const { system, chatMessages } = extractSystemMessage(request.messages);
    const messages = chatMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const { data, latencyMs, status } = await fetchJson<AnthropicResponse>(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: apiModel,
          max_tokens: request.maxTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
          system: system || undefined,
          messages,
        }),
      }
    );

    if (status >= 400 || data.error) {
      throw new Error(data.error?.message || `Claude API error ${status}`);
    }

    const content = (data.content ?? []).map((b) => b.text ?? "").join("\n");

    return {
      content,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      model: publicModel,
      provider: "claude",
      latencyMs,
    };
  },
};
