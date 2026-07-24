/** Phase 5 Module 1 — Unified Provider Foundation public API. */

export type { AIProvider } from "./provider";
export { BaseAIProvider } from "./base-provider";
export type { BaseProviderConfig } from "./base-provider";

export {
  bootstrapDefaultProviders,
  clearProviderRegistry,
  getProvider,
  listProviderIds,
  listProviderRegistryEntries,
  listProviders,
  providerRegistrySize,
  refreshProviderHealth,
  registerProvider,
  requireProvider,
  unregisterProvider,
} from "./registry";

export {
  clearHealthRecords,
  computeHealthSnapshot,
  getHealthRecord,
  recordHealthFailure,
  recordHealthSuccess,
  runAllProviderHealthChecks,
  runProviderHealthCheck,
} from "./health";

export {
  clearModelRegistry,
  getModel,
  listAllModels,
  listEuCompliantModels,
  listModelsByLifecycle,
  listModelsByProvider,
  modelRegistrySize,
  registerModel,
  registerModels,
} from "./model-registry";

export { createOpenAIProvider, OpenAIProvider } from "./openai/provider";
export { OPENAI_MODELS } from "./openai/models";
export { createGeminiProvider, GeminiProvider } from "./gemini/provider";
export { GEMINI_MODELS } from "./gemini/models";
export { createClaudeProvider, ClaudeProvider } from "./claude/provider";
export { CLAUDE_MODELS } from "./claude/models";
export { createDeepSeekProvider, DeepSeekProvider } from "./deepseek/provider";
export { DEEPSEEK_MODELS } from "./deepseek/models";
export { createQwenProvider, QwenProvider } from "./qwen/provider";
export { QWEN_MODELS } from "./qwen/models";

export * from "./types";
