import type {
  AudioGenerationRequest,
  AudioGenerationResponse,
  CostEstimateRequest,
  CostEstimateResult,
  EmbeddingsRequest,
  EmbeddingsResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ModelRegistryEntry,
  NormalizedProviderError,
  NormalizedUsage,
  ProviderHealthSnapshot,
  ProviderId,
  ProviderRegistryEntry,
  StreamChatChunk,
  UnifiedChatRequest,
  UnifiedChatResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from "./types";

/**
 * Unified provider interface — all AI providers must implement this contract.
 * Phase 5 Module 1: framework stubs only; no real upstream API calls.
 */
export interface AIProvider {
  readonly id: ProviderId;
  readonly metadata: ProviderRegistryEntry;

  health(): Promise<ProviderHealthSnapshot>;
  listModels(): Promise<ModelRegistryEntry[]>;
  chat(request: UnifiedChatRequest): Promise<UnifiedChatResponse>;
  streamChat(request: UnifiedChatRequest): AsyncIterable<StreamChatChunk>;
  embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse>;
  imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
  audioGeneration(request: AudioGenerationRequest): Promise<AudioGenerationResponse>;
  videoGeneration(request: VideoGenerationRequest): Promise<VideoGenerationResponse>;
  estimateCost(request: CostEstimateRequest): Promise<CostEstimateResult>;
  normalizeUsage(raw: unknown): NormalizedUsage;
  normalizeError(error: unknown): NormalizedProviderError;
}
