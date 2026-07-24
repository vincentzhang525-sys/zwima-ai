import { BaseAIProvider } from "../base-provider";
import { OPENAI_MODELS } from "./models";

export class OpenAIProvider extends BaseAIProvider {
  constructor(configured = true) {
    super({
      id: "openai",
      displayName: "OpenAI",
      priority: 90,
      weight: 100,
      region: "GLOBAL",
      euAvailable: true,
      apiEndpoint: "https://api.openai.com/v1",
      authenticationType: "api_key",
      supportedFeatures: [
        "chat",
        "stream_chat",
        "embeddings",
        "image_generation",
        "audio_generation",
        "function_calling",
        "vision",
      ],
      defaultModels: ["gpt-5", "gpt-5-mini"],
      pricingMetadata: { currency: "USD", billingUnit: "token" },
      lifecycleStatus: "ACTIVE",
      models: OPENAI_MODELS,
      configured,
    });
  }
}

export function createOpenAIProvider(configured = true): OpenAIProvider {
  return new OpenAIProvider(configured);
}
