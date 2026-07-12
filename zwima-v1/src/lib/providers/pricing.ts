/** Per-model pricing: credits per 1K tokens (input / output). */
export type ModelPricing = {
  inputPer1k: number;
  outputPer1k: number;
};

const DEFAULT_PRICING: ModelPricing = { inputPer1k: 1, outputPer1k: 2 };

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Gemini
  "gemini-2.5-pro": { inputPer1k: 2, outputPer1k: 8 },
  "gemini-2.5-flash": { inputPer1k: 0.5, outputPer1k: 1.5 },
  "gemini-2.5-flash-lite": { inputPer1k: 0.2, outputPer1k: 0.6 },
  // OpenAI
  "gpt-5": { inputPer1k: 5, outputPer1k: 15 },
  "gpt-5-mini": { inputPer1k: 1, outputPer1k: 4 },
  "gpt-5-nano": { inputPer1k: 0.3, outputPer1k: 1 },
  // DeepSeek
  "deepseek-chat": { inputPer1k: 0.4, outputPer1k: 1.2 },
  "deepseek-reasoner": { inputPer1k: 1, outputPer1k: 3 },
  // Qwen
  "qwen-plus": { inputPer1k: 0.8, outputPer1k: 2 },
  "qwen-max": { inputPer1k: 2, outputPer1k: 6 },
  // Claude
  "claude-sonnet": { inputPer1k: 1.5, outputPer1k: 5 },
  "claude-opus": { inputPer1k: 4, outputPer1k: 12 },
};

export function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model.toLowerCase()] ?? DEFAULT_PRICING;
}

export function getMarginMultiplier(): number {
  const raw = process.env.CREDITS_MARGIN || "1.3";
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : 1.3;
}

export function estimateCredits(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = getModelPricing(model);
  const base =
    (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
  const withMargin = base * getMarginMultiplier();
  return Math.max(1, Math.ceil(withMargin));
}

/** Rough pre-flight estimate when output tokens are unknown. */
export function estimateCreditsForRequest(
  inputTokens: number,
  maxOutputTokens: number,
  model: string
): number {
  return estimateCredits(inputTokens, maxOutputTokens, model);
}

export function countMessageTokens(messages: { content: string }[]): number {
  return messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0);
}
