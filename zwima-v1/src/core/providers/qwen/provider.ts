import { BaseAIProvider } from "../base-provider";
import { QWEN_MODELS } from "./models";

export class QwenProvider extends BaseAIProvider {
  constructor(configured = true) {
    super({
      id: "qwen",
      displayName: "Alibaba Qwen",
      priority: 75,
      weight: 85,
      region: "CN",
      euAvailable: false,
      apiEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      authenticationType: "api_key",
      supportedFeatures: ["chat", "stream_chat", "embeddings"],
      defaultModels: ["qwen-turbo", "qwen-plus"],
      pricingMetadata: { currency: "USD", billingUnit: "token", notes: "Intl endpoint default" },
      lifecycleStatus: "ACTIVE",
      models: QWEN_MODELS,
      configured,
    });
  }
}

export function createQwenProvider(configured = true): QwenProvider {
  return new QwenProvider(configured);
}
