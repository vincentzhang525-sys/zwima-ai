export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
};

export type ChatResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
  latencyMs: number;
};

export type CostEstimate = {
  inputTokens: number;
  outputTokens: number;
  baseCredits: number;
  marginCredits: number;
  totalCredits: number;
};

export type ProviderErrorCode =
  | "invalid_api_key"
  | "insufficient_balance"
  | "region_mismatch"
  | "model_not_available"
  | "rate_limited"
  | "timeout"
  | "provider_unavailable";

export type HealthResult = {
  status: "ok" | "error" | "unconfigured";
  latencyMs: number | null;
  error: string | null;
  errorCode?: ProviderErrorCode | null;
  endpoint?: string | null;
  model?: string | null;
};

export type ModelInfo = {
  id: string;
  provider: string;
  name: string;
};

/** Unified provider adapter interface — all providers must implement this. */
export interface ProviderAdapter {
  readonly slug: string;
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResult>;
  models(): ModelInfo[];
  health(): Promise<HealthResult>;
  estimateCost(inputTokens: number, outputTokens: number, model: string): number;
}

export type RouteResult = {
  adapter: ProviderAdapter;
  model: string;
};
