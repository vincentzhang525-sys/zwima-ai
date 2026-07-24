import type { ProviderId } from "@/core/providers/types";

export type AdapterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AdapterChatRequest = {
  model: string;
  messages: AdapterChatMessage[];
  maxTokens?: number;
  temperature?: number;
};

export type AdapterChatResponse = {
  id: string;
  provider: ProviderId;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  finishReason: "stop" | "length" | "error";
};

export type AdapterStreamChunk = {
  id: string;
  provider: ProviderId;
  model: string;
  delta: string;
  done: boolean;
  usage?: { inputTokens: number; outputTokens: number };
};

export type AdapterEmbeddingsRequest = {
  model: string;
  input: string | string[];
};

export type AdapterEmbeddingsResponse = {
  id: string;
  provider: ProviderId;
  model: string;
  vectors: number[][];
  dimensions: number;
  inputTokens: number;
};

export type AdapterModelInfo = {
  id: string;
  provider: ProviderId;
  name: string;
  streaming: boolean;
  embedding: boolean;
  euCompliance: boolean;
};

export type AdapterHealthResult = {
  provider: ProviderId;
  online: boolean;
  latencyMs: number | null;
  error: string | null;
  configured: boolean;
};

export type AdapterPricingQuote = {
  provider: ProviderId;
  model: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  currency: "USD";
};

/** Task 2.1 — unified provider adapter contract. */
export interface UnifiedProviderAdapter {
  readonly id: ProviderId;
  chat(request: AdapterChatRequest): Promise<AdapterChatResponse>;
  stream(request: AdapterChatRequest): AsyncIterable<AdapterStreamChunk>;
  embeddings(request: AdapterEmbeddingsRequest): Promise<AdapterEmbeddingsResponse>;
  models(): AdapterModelInfo[];
  health(): Promise<AdapterHealthResult>;
  pricing(): AdapterPricingQuote[];
}
