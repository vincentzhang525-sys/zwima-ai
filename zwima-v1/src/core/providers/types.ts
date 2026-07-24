/** Phase 5 Module 1 — unified provider foundation types. */

export type ProviderId = "openai" | "gemini" | "claude" | "deepseek" | "qwen";

export type ProviderOperationalStatus = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNCONFIGURED";

export type LifecycleStatus = "DRAFT" | "ACTIVE" | "DEPRECATED" | "RETIRED";

export type AuthenticationType = "api_key" | "oauth" | "service_account";

export type ProviderRegion = "GLOBAL" | "US" | "EU" | "APAC" | "CN";

export type SupportedFeature =
  | "chat"
  | "stream_chat"
  | "embeddings"
  | "image_generation"
  | "audio_generation"
  | "video_generation"
  | "function_calling"
  | "vision";

export type ProviderRegistryEntry = {
  id: ProviderId;
  displayName: string;
  status: ProviderOperationalStatus;
  priority: number;
  weight: number;
  health: ProviderHealthSnapshot;
  region: ProviderRegion;
  euAvailable: boolean;
  apiEndpoint: string;
  authenticationType: AuthenticationType;
  supportedFeatures: SupportedFeature[];
  defaultModels: string[];
  pricingMetadata: ProviderPricingMetadata;
  lifecycleStatus: LifecycleStatus;
};

export type ProviderPricingMetadata = {
  currency: "USD" | "EUR";
  billingUnit: "token" | "request" | "second" | "pixel";
  notes?: string;
};

export type ModelRegistryEntry = {
  modelId: string;
  provider: ProviderId;
  displayName: string;
  contextWindow: number;
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  image: boolean;
  embedding: boolean;
  audio: boolean;
  video: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  lifecycle: LifecycleStatus;
  regionAvailability: ProviderRegion[];
  euCompliance: boolean;
  releaseDate: string;
  deprecatedDate: string | null;
  replacementModel: string | null;
};

export type ProviderHealthSnapshot = {
  online: boolean;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  errorRate: number;
  quotaRemaining: number | null;
  status: ProviderOperationalStatus;
  message: string | null;
};

export type UnifiedChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type UnifiedChatRequest = {
  model: string;
  messages: UnifiedChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
};

export type UnifiedChatResponse = {
  id: string;
  provider: ProviderId;
  model: string;
  content: string;
  finishReason: "stop" | "length" | "error";
  usage: NormalizedUsage;
  latencyMs: number;
  createdAt: string;
};

export type StreamChatChunk = {
  id: string;
  provider: ProviderId;
  model: string;
  delta: string;
  done: boolean;
  usage?: NormalizedUsage;
};

export type EmbeddingsRequest = {
  model: string;
  input: string | string[];
};

export type EmbeddingsResponse = {
  id: string;
  provider: ProviderId;
  model: string;
  vectors: number[][];
  dimensions: number;
  usage: NormalizedUsage;
};

export type ImageGenerationRequest = {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
};

export type ImageGenerationResponse = {
  id: string;
  provider: ProviderId;
  model: string;
  images: { url: string; revisedPrompt?: string }[];
  usage: NormalizedUsage;
};

export type AudioGenerationRequest = {
  model: string;
  input: string;
  voice?: string;
};

export type AudioGenerationResponse = {
  id: string;
  provider: ProviderId;
  model: string;
  audioUrl: string;
  usage: NormalizedUsage;
};

export type VideoGenerationRequest = {
  model: string;
  prompt: string;
  durationSeconds?: number;
};

export type VideoGenerationResponse = {
  id: string;
  provider: ProviderId;
  model: string;
  videoUrl: string;
  usage: NormalizedUsage;
};

export type CostEstimateRequest = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type CostEstimateResult = {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
};

export type NormalizedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  billableUnits: number;
  unit: "token" | "request" | "second";
};

export type NormalizedProviderErrorCode =
  | "invalid_api_key"
  | "insufficient_balance"
  | "region_mismatch"
  | "model_not_available"
  | "rate_limited"
  | "timeout"
  | "provider_unavailable"
  | "unsupported_feature"
  | "validation_error"
  | "internal_error";

export type NormalizedProviderError = {
  code: NormalizedProviderErrorCode;
  message: string;
  provider: ProviderId;
  retryable: boolean;
  httpStatus: number | null;
  raw?: unknown;
};
