export type RoutingCapability =
  | "chat"
  | "stream"
  | "embeddings"
  | "vision"
  | "function_calling"
  | "image"
  | "audio"
  | "video";

export type RoutingRequest = {
  model?: string;
  provider?: string;
  capability: RoutingCapability;
  region?: "EU" | "US" | "GLOBAL" | "APAC" | "CN";
  requireEuCompliance?: boolean;
  streaming?: boolean;
  organizationId?: string;
  monthlyBudgetUsd?: number | null;
};

export type RoutingCandidate = {
  provider: import("@/core/providers/types").ProviderId;
  model: string;
  score: number;
  reasons: string[];
  euCompliance: boolean;
  latencyMs: number | null;
  online: boolean;
};

export type RoutingDecision = {
  requestId: string;
  selected: RoutingCandidate;
  fallbackChain: RoutingCandidate[];
  rejectedCount: number;
};

export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};
