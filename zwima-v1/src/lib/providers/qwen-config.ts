import type { ProviderErrorCode } from "./types";

export const QWEN_ENDPOINT_CN = "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const QWEN_ENDPOINT_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export const QWEN_HEALTH_MODELS = ["qwen-turbo", "qwen-plus"] as const;

let resolvedBaseUrl: string | null = null;
let resolvedVia: "env" | "cn" | "intl" | null = null;

export function getQwenApiKey(): string | null {
  return (
    process.env.QWEN_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim() ||
    process.env.DASHCOPE_API_KEY?.trim() ||
    null
  );
}

export function getConfiguredBaseUrl(): string | null {
  const custom = process.env.QWEN_BASE_URL?.trim();
  return custom ? custom.replace(/\/$/, "") : null;
}

export function getResolvedBaseUrl(): string | null {
  return resolvedBaseUrl ?? getConfiguredBaseUrl();
}

export function setResolvedBaseUrl(url: string, via: "env" | "cn" | "intl") {
  resolvedBaseUrl = url.replace(/\/$/, "");
  resolvedVia = via;
}

export function getResolvedVia() {
  return resolvedVia;
}

export function defaultBaseUrlCandidates(): { url: string; via: "cn" | "intl" }[] {
  const custom = getConfiguredBaseUrl();
  if (custom) return [{ url: custom, via: "cn" }];
  return [
    { url: QWEN_ENDPOINT_CN, via: "cn" },
    { url: QWEN_ENDPOINT_INTL, via: "intl" },
  ];
}

export function classifyQwenError(status: number, message: string): ProviderErrorCode {
  const m = String(message || "").toLowerCase();
  if (status === 401 || (m.includes("invalid") && m.includes("api")) || m.includes("incorrect api key")) {
    return "invalid_api_key";
  }
  if (
    m.includes("insufficient") ||
    m.includes("balance") ||
    m.includes("quota") ||
    m.includes("exceeded your current quota")
  ) {
    return "insufficient_balance";
  }
  if (
    m.includes("region") ||
    m.includes("access denied") ||
    m.includes("not supported in") ||
    m.includes("invalidendpoint") ||
    (m.includes("endpoint") && m.includes("not valid"))
  ) {
    return "region_mismatch";
  }
  if (m.includes("model") && (m.includes("not found") || m.includes("does not exist") || m.includes("not exist"))) {
    return "model_not_available";
  }
  if (status === 429 || m.includes("rate limit") || m.includes("too many requests")) {
    return "rate_limited";
  }
  if (m.includes("timeout") || m.includes("timed out") || m.includes("abort")) {
    return "timeout";
  }
  return "provider_unavailable";
}

export function formatQwenError(code: ProviderErrorCode, message: string): string {
  return `[${code}] ${message}`;
}

export function shouldTryAlternateEndpoint(code: ProviderErrorCode): boolean {
  return code === "region_mismatch" || code === "invalid_api_key";
}

export type OpenAiCompatErrorBody = {
  error?: { message?: string; code?: string; type?: string };
};
