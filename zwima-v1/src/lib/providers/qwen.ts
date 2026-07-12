import { estimateCredits } from "./pricing";
import { extractSystemMessage, openAiCompatibleChat, parseOpenAiResponse } from "./http";
import {
  classifyQwenError,
  defaultBaseUrlCandidates,
  formatQwenError,
  getQwenApiKey,
  getResolvedBaseUrl,
  QWEN_HEALTH_MODELS,
  setResolvedBaseUrl,
  shouldTryAlternateEndpoint,
  type OpenAiCompatErrorBody,
} from "./qwen-config";
import type { ChatRequest, ChatResult, HealthResult, ModelInfo, ProviderAdapter } from "./types";

const MODELS: ModelInfo[] = [
  { id: "qwen-turbo", provider: "qwen", name: "Qwen Turbo" },
  { id: "qwen-plus", provider: "qwen", name: "Qwen Plus" },
  { id: "qwen-max", provider: "qwen", name: "Qwen Max" },
];

type QwenRequestResult = {
  data: OpenAiCompatErrorBody & {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  latencyMs: number;
  status: number;
  baseUrl: string;
  via: "env" | "cn" | "intl";
  model: string;
};

async function requestOnce(
  baseUrl: string,
  via: "env" | "cn" | "intl",
  model: string,
  body: Record<string, unknown>
): Promise<QwenRequestResult> {
  const key = getQwenApiKey();
  if (!key) throw new Error(formatQwenError("invalid_api_key", "QWEN_API_KEY not configured"));

  const { data, latencyMs, status } = await openAiCompatibleChat(baseUrl, key, { ...body, model });
  return { data, latencyMs, status, baseUrl, via, model };
}

async function resolveAndRequest(body: Record<string, unknown>, model: string): Promise<QwenRequestResult> {
  const cached = getResolvedBaseUrl();
  if (cached) {
    const via = cached.includes("dashscope-intl") ? "intl" : cached.includes("dashscope.aliyuncs") ? "cn" : "env";
    const result = await requestOnce(cached, via, model, body);
    if (result.status < 400) return result;
    const code = classifyQwenError(result.status, result.data.error?.message || "");
    throw new Error(formatQwenError(code, result.data.error?.message || `HTTP ${result.status}`));
  }

  const candidates = defaultBaseUrlCandidates();
  let last: QwenRequestResult | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const { url, via } = candidates[i];
    const result = await requestOnce(url, via, model, body);
    if (result.status < 400) {
      setResolvedBaseUrl(url, via);
      return result;
    }

    last = result;
    const code = classifyQwenError(result.status, result.data.error?.message || "");
    const hasAlternate = i + 1 < candidates.length;
    if (!hasAlternate || !shouldTryAlternateEndpoint(code)) break;
  }

  const code = classifyQwenError(last!.status, last!.data.error?.message || "");
  throw new Error(formatQwenError(code, last!.data.error?.message || `HTTP ${last!.status}`));
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
    const key = getQwenApiKey();
    if (!key) {
      return {
        status: "unconfigured",
        latencyMs: null,
        error: formatQwenError("invalid_api_key", "QWEN_API_KEY not set"),
        errorCode: "invalid_api_key",
      };
    }

    let lastHealth: HealthResult = {
      status: "error",
      latencyMs: null,
      error: "Health check failed",
      errorCode: "provider_unavailable",
    };

    for (const model of QWEN_HEALTH_MODELS) {
      try {
        const { latencyMs, status, data, baseUrl } = await resolveAndRequest(
          {
            messages: [{ role: "user", content: "Reply only with: OK" }],
            max_tokens: 8,
            temperature: 0,
          },
          model
        );

        if (status >= 400) {
          const code = classifyQwenError(status, data.error?.message || "");
          lastHealth = {
            status: "error",
            latencyMs,
            error: formatQwenError(code, data.error?.message || `HTTP ${status}`),
            errorCode: code,
            endpoint: baseUrl,
            model,
          };
          continue;
        }

        return {
          status: "ok",
          latencyMs,
          error: null,
          errorCode: null,
          endpoint: baseUrl,
          model,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Health check failed";
        const codeMatch = msg.match(/^\[([^\]]+)\]/);
        lastHealth = {
          status: "error",
          latencyMs: null,
          error: msg,
          errorCode: (codeMatch?.[1] as HealthResult["errorCode"]) ?? "provider_unavailable",
          model,
        };
      }
    }

    return lastHealth;
  },

  async chat(request: ChatRequest): Promise<ChatResult> {
    const model = MODELS.find((m) => m.id === request.model)?.id ?? request.model;
    const { system, chatMessages } = extractSystemMessage(request.messages);
    const messages = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...chatMessages,
    ];

    const { data, latencyMs, status, baseUrl } = await resolveAndRequest(
      {
        messages,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
      },
      model
    );

    if (status >= 400) {
      const code = classifyQwenError(status, data.error?.message || "");
      throw new Error(formatQwenError(code, data.error?.message || `Qwen API error ${status}`));
    }

    const result = parseOpenAiResponse(data, model, "qwen", latencyMs);
    if (!getResolvedBaseUrl() && baseUrl) {
      const via = baseUrl.includes("dashscope-intl") ? "intl" : "cn";
      setResolvedBaseUrl(baseUrl, via);
    }
    return result;
  },
};
