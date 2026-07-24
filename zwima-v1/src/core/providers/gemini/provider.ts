import { BaseAIProvider } from "../base-provider";
import { GEMINI_MODELS } from "./models";

export class GeminiProvider extends BaseAIProvider {
  constructor(configured = true) {
    super({
      id: "gemini",
      displayName: "Google Gemini",
      priority: 95,
      weight: 110,
      region: "GLOBAL",
      euAvailable: true,
      apiEndpoint: "https://generativelanguage.googleapis.com/v1beta",
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
      defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
      pricingMetadata: { currency: "USD", billingUnit: "token" },
      lifecycleStatus: "ACTIVE",
      models: GEMINI_MODELS,
      configured,
    });
  }
}

export function createGeminiProvider(configured = true): GeminiProvider {
  return new GeminiProvider(configured);
}
