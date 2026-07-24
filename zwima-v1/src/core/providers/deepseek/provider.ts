import { BaseAIProvider } from "../base-provider";
import { DEEPSEEK_MODELS } from "./models";

export class DeepSeekProvider extends BaseAIProvider {
  constructor(configured = true) {
    super({
      id: "deepseek",
      displayName: "DeepSeek",
      priority: 70,
      weight: 80,
      region: "APAC",
      euAvailable: false,
      apiEndpoint: "https://api.deepseek.com/v1",
      authenticationType: "api_key",
      supportedFeatures: ["chat", "stream_chat", "function_calling"],
      defaultModels: ["deepseek-chat"],
      pricingMetadata: { currency: "USD", billingUnit: "token" },
      lifecycleStatus: "ACTIVE",
      models: DEEPSEEK_MODELS,
      configured,
    });
  }
}

export function createDeepSeekProvider(configured = true): DeepSeekProvider {
  return new DeepSeekProvider(configured);
}
