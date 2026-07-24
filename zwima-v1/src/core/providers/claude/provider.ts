import { BaseAIProvider } from "../base-provider";
import { CLAUDE_MODELS } from "./models";

export class ClaudeProvider extends BaseAIProvider {
  constructor(configured = true) {
    super({
      id: "claude",
      displayName: "Anthropic Claude",
      priority: 85,
      weight: 95,
      region: "US",
      euAvailable: true,
      apiEndpoint: "https://api.anthropic.com/v1",
      authenticationType: "api_key",
      supportedFeatures: ["chat", "stream_chat", "function_calling", "vision"],
      defaultModels: ["claude-sonnet-4"],
      pricingMetadata: { currency: "USD", billingUnit: "token" },
      lifecycleStatus: "ACTIVE",
      models: CLAUDE_MODELS,
      configured,
    });
  }
}

export function createClaudeProvider(configured = true): ClaudeProvider {
  return new ClaudeProvider(configured);
}
