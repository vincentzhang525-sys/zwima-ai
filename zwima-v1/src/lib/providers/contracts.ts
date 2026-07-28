/**
 * GAP-015 — Shared provider contract aliases (reuse existing adapter + core types).
 * Do not invent a parallel provider stack.
 */

export type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  CostEstimate,
  HealthResult,
  ModelInfo,
  ProviderAdapter,
  ProviderErrorCode,
  RouteResult,
} from "./types";

export type {
  NormalizedProviderError,
  NormalizedUsage,
  ProviderId,
  ProviderOperationalStatus,
  ProviderRegion,
  UnifiedChatRequest,
  UnifiedChatResponse,
} from "@/core/providers/types";

export const REQUIRED_ADAPTER_METHODS = [
  "slug",
  "name",
  "chat",
  "models",
  "health",
  "estimateCost",
] as const;

export type ProviderGateStatus = "ACTIVE" | "DISABLED" | "UNAVAILABLE" | "CONFIG_PENDING";

export type ProviderReadinessVerdict =
  | "PASS"
  | "PASS_OR_CONFIG_PENDING"
  | "FAIL";
