import { randomUUID } from "crypto";
import type { AIProvider } from "./provider";
import { registerModel, registerModels } from "./model-registry";
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
  NormalizedProviderErrorCode,
  NormalizedUsage,
  ProviderHealthSnapshot,
  ProviderId,
  ProviderRegistryEntry,
  StreamChatChunk,
  SupportedFeature,
  UnifiedChatRequest,
  UnifiedChatResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from "./types";
import { computeHealthSnapshot } from "./health";

export type BaseProviderConfig = {
  id: ProviderId;
  displayName: string;
  priority: number;
  weight: number;
  region: ProviderRegistryEntry["region"];
  euAvailable: boolean;
  apiEndpoint: string;
  authenticationType: ProviderRegistryEntry["authenticationType"];
  supportedFeatures: SupportedFeature[];
  defaultModels: string[];
  pricingMetadata: ProviderRegistryEntry["pricingMetadata"];
  lifecycleStatus: ProviderRegistryEntry["lifecycleStatus"];
  models: ModelRegistryEntry[];
  configured?: boolean;
};

function defaultUsage(input = 0, output = 0): NormalizedUsage {
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    billableUnits: input + output,
    unit: "token",
  };
}

function findModel(config: BaseProviderConfig, modelId: string): ModelRegistryEntry | undefined {
  return config.models.find((m) => m.modelId === modelId);
}

export abstract class BaseAIProvider implements AIProvider {
  protected readonly config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
    registerModels(config.models);
  }

  get id(): ProviderId {
    return this.config.id;
  }

  get metadata(): ProviderRegistryEntry {
    return {
      id: this.config.id,
      displayName: this.config.displayName,
      status: this.config.configured === false ? "UNCONFIGURED" : "ONLINE",
      priority: this.config.priority,
      weight: this.config.weight,
      health: computeHealthSnapshot(this.config.id, this.config.configured !== false, 42, null),
      region: this.config.region,
      euAvailable: this.config.euAvailable,
      apiEndpoint: this.config.apiEndpoint,
      authenticationType: this.config.authenticationType,
      supportedFeatures: this.config.supportedFeatures,
      defaultModels: this.config.defaultModels,
      pricingMetadata: this.config.pricingMetadata,
      lifecycleStatus: this.config.lifecycleStatus,
    };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    const configured = this.config.configured !== false;
    return computeHealthSnapshot(
      this.id,
      configured,
      configured ? 42 : null,
      configured ? null : "Provider API key not configured (stub)",
    );
  }

  async listModels(): Promise<ModelRegistryEntry[]> {
    return this.config.models;
  }

  async chat(request: UnifiedChatRequest): Promise<UnifiedChatResponse> {
    this.assertFeature("chat");
    const model = this.resolveModel(request.model);
    const inputTokens = this.estimateTokens(request.messages.map((m) => m.content).join(" "));
    const outputTokens = Math.min(request.maxTokens ?? 64, 64);
    const content = `[${this.id}] stub response for ${model.modelId}`;

    return {
      id: randomUUID(),
      provider: this.id,
      model: model.modelId,
      content,
      finishReason: "stop",
      usage: defaultUsage(inputTokens, outputTokens),
      latencyMs: 42,
      createdAt: new Date().toISOString(),
    };
  }

  async *streamChat(request: UnifiedChatRequest): AsyncIterable<StreamChatChunk> {
    this.assertFeature("stream_chat");
    const model = this.resolveModel(request.model);
    const text = `[${this.id}] stub stream for ${model.modelId}`;
    const id = randomUUID();

    for (let i = 0; i < text.length; i += 8) {
      yield {
        id,
        provider: this.id,
        model: model.modelId,
        delta: text.slice(i, i + 8),
        done: false,
      };
    }

    yield {
      id,
      provider: this.id,
      model: model.modelId,
      delta: "",
      done: true,
      usage: defaultUsage(this.estimateTokens(request.messages.map((m) => m.content).join(" ")), 32),
    };
  }

  async embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
    this.assertFeature("embeddings");
    const model = this.resolveModel(request.model);
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const vectors = inputs.map((_, idx) => Array.from({ length: 8 }, (_, i) => (idx + i + 1) / 100));

    return {
      id: randomUUID(),
      provider: this.id,
      model: model.modelId,
      vectors,
      dimensions: 8,
      usage: defaultUsage(inputs.join(" ").length, 0),
    };
  }

  async imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    this.assertFeature("image_generation");
    const model = this.resolveModel(request.model);
    const count = request.n ?? 1;

    return {
      id: randomUUID(),
      provider: this.id,
      model: model.modelId,
      images: Array.from({ length: count }, (_, i) => ({
        url: `https://stub.zwima.ai/${this.id}/${model.modelId}/${i + 1}.png`,
        revisedPrompt: request.prompt,
      })),
      usage: defaultUsage(request.prompt.length, 0),
    };
  }

  async audioGeneration(request: AudioGenerationRequest): Promise<AudioGenerationResponse> {
    this.assertFeature("audio_generation");
    const model = this.resolveModel(request.model);

    return {
      id: randomUUID(),
      provider: this.id,
      model: model.modelId,
      audioUrl: `https://stub.zwima.ai/${this.id}/${model.modelId}/audio.mp3`,
      usage: defaultUsage(request.input.length, 0),
    };
  }

  async videoGeneration(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    this.assertFeature("video_generation");
    const model = this.resolveModel(request.model);

    return {
      id: randomUUID(),
      provider: this.id,
      model: model.modelId,
      videoUrl: `https://stub.zwima.ai/${this.id}/${model.modelId}/video.mp4`,
      usage: defaultUsage(request.prompt.length, 0),
    };
  }

  async estimateCost(request: CostEstimateRequest): Promise<CostEstimateResult> {
    const model = this.resolveModel(request.model);
    const inputCostUsd = (request.inputTokens / 1_000_000) * model.inputCostPer1M;
    const outputCostUsd = (request.outputTokens / 1_000_000) * model.outputCostPer1M;

    return {
      provider: this.id,
      model: model.modelId,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
      inputCostUsd,
      outputCostUsd,
      totalCostUsd: inputCostUsd + outputCostUsd,
    };
  }

  normalizeUsage(raw: unknown): NormalizedUsage {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const input = Number(obj.inputTokens ?? obj.prompt_tokens ?? 0);
      const output = Number(obj.outputTokens ?? obj.completion_tokens ?? 0);
      return defaultUsage(input, output);
    }
    return defaultUsage();
  }

  normalizeError(error: unknown): NormalizedProviderError {
    const message = error instanceof Error ? error.message : String(error);
    let code: NormalizedProviderErrorCode = "internal_error";
    if (/rate.?limit/i.test(message)) code = "rate_limited";
    else if (/timeout/i.test(message)) code = "timeout";
    else if (/unavailable|503/i.test(message)) code = "provider_unavailable";
    else if (/api.?key|unauthorized/i.test(message)) code = "invalid_api_key";
    else if (/unsupported/i.test(message)) code = "unsupported_feature";

    const retryable =
      code === "rate_limited" || code === "timeout" || code === "provider_unavailable";

    return {
      code,
      message,
      provider: this.id,
      retryable,
      httpStatus: null,
      raw: error,
    };
  }

  protected resolveModel(modelId: string): ModelRegistryEntry {
    const model = findModel(this.config, modelId) ?? findModel(this.config, this.config.defaultModels[0]!);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    registerModel(model);
    return model;
  }

  protected assertFeature(feature: SupportedFeature): void {
    if (!this.config.supportedFeatures.includes(feature)) {
      throw new Error(`Feature not supported by ${this.id}: ${feature}`);
    }
  }

  protected estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}
