import type { RoutingStrategy } from "@prisma/client";

// ─── Legacy types (policy engine v0 — unchanged) ───────────────────────────

export type RoutingCapability = "chat" | "tools" | "vision" | "json" | "reasoning";

export type RoutingInput = {
  organizationId?: string | null;
  apiKeyId: string;
  requestedModel: string;
  capability?: RoutingCapability;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  requestType?: string;
  requiredRegion?: string | null;
  maximumCost?: number | null;
  routingPolicyId?: string | null;
  strategy?: RoutingStrategy;
  allowedProviders?: string[];
  allowedModels?: string[];
  blockedProviders?: string[];
  blockedModels?: string[];
};

export type RoutingCandidate = {
  providerSlug: string;
  providerId: string;
  modelCode: string;
  providerModelId: string;
  displayName: string;
  region?: string | null;
  dataResidency?: string | null;
  qualityTier: string;
  estimatedProviderCostEur: number;
  estimatedCustomerCharge: number;
  estimatedMarginPercent: number;
  latencyP50?: number | null;
  healthStatus: string;
  pricingRecordId?: string;
  excluded?: boolean;
  exclusionReason?: string;
  scores?: {
    cost: number;
    latency: number;
    quality: number;
    reliability: number;
    region: number;
    total: number;
  };
};

export type RoutingDecision = {
  selected: RoutingCandidate;
  candidates: RoutingCandidate[];
  excluded: RoutingCandidate[];
  strategy: RoutingStrategy;
  policyId?: string | null;
  routingReason: string;
  estimatedCost: number;
  estimatedCustomerCharge: number;
  estimatedMarginPercent: number;
  fallbackCount: number;
  attemptedProviders: string[];
};

export type RoutingWeights = {
  costWeight: number;
  latencyWeight: number;
  qualityWeight: number;
  reliabilityWeight: number;
  regionWeight: number;
};

// ─── Smart Routing V1 types ────────────────────────────────────────────────

export type RequestCapability = "chat" | "embedding" | "image" | "audio" | "video";
export type LatencyTier = "LOW" | "STANDARD" | "RELAXED";
export type OptimizationMode =
  | "BALANCED"
  | "LOWEST_COST"
  | "LOWEST_LATENCY"
  | "HIGHEST_QUALITY"
  | "EU_COMPLIANCE";

export type RoutingPolicyConfig = {
  optimizationMode: OptimizationMode;
  euOnly: boolean;
  allowedProviders: string[];
  blockedProviders: string[];
  allowedRegions: string[];
  maxCostPerRequestEur: number | null;
  maxLatencyMs: number | null;
  minimumQualityScore: number;
  allowFallback: boolean;
  maxFallbackAttempts: number;
  preferCachedResponse: boolean;
  requireStreaming: boolean;
  requireDataResidency: boolean;
  requireTransparencyDisclosure: boolean;
};

export type RoutingRequestContext = {
  requestId: string;
  organizationId?: string | null;
  projectId?: string | null;
  apiKeyId: string;
  requestedModel: string;
  preferredProvider?: string | null;
  capability: RequestCapability;
  region?: string | null;
  userCountry?: string | null;
  euOnly: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  expectedLatencyTier: LatencyTier;
  optimizationMode: OptimizationMode;
  streamingRequired: boolean;
  fallbackAllowed: boolean;
  excludedProviders: string[];
  preferredProviders: string[];
  metadata: Record<string, unknown>;
  policy: RoutingPolicyConfig;
  policySources: string[];
};

export type ProviderCandidate = {
  providerId: string;
  providerName: string;
  providerSlug: string;
  modelId: string;
  modelName: string;
  providerModelId: string;
  enabled: boolean;
  providerStatus: string;
  modelStatus: string;
  region: string | null;
  supportedRegions: string[];
  supportsStreaming: boolean;
  supportsEmbedding: boolean;
  supportsImage: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  inputPrice: number;
  outputPrice: number;
  cacheReadPrice: number;
  cacheWritePrice: number;
  estimatedRequestCostEur: number;
  estimatedCustomerChargeCredits: number;
  latencyP50: number | null;
  latencyP95: number | null;
  successRate: number;
  errorRate: number;
  qualityScore: number;
  routingPriority: number;
  routingWeight: number;
  promotionActive: boolean;
  promotionEndDate: string | null;
  euCompliant: boolean;
  dataResidencyRegions: string[];
  hasApiKey: boolean;
  excluded: boolean;
  exclusionReasons: string[];
  scoreBreakdown?: SmartScoreBreakdown;
  totalScore: number;
};

export type SmartScoreBreakdown = {
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
  qualityScore: number;
  complianceScore: number;
  priorityScore: number;
  promotionScore: number;
  weights: Record<string, number>;
  totalScore: number;
};

export type SmartRoutingDecision = {
  requestId: string;
  selectedProviderId: string;
  selectedProviderName: string;
  selectedProviderSlug: string;
  selectedModelId: string;
  selectedModelName: string;
  selectedProviderModelId: string;
  totalScore: number;
  estimatedCostEur: number;
  estimatedCustomerChargeCredits: number;
  estimatedLatencyMs: number | null;
  selectedRegion: string | null;
  optimizationMode: OptimizationMode;
  decisionReasons: string[];
  candidateCount: number;
  rejectedCandidateCount: number;
  fallbackChain: string[];
  complianceFlags: {
    transparencyRequired: boolean;
    aiGeneratedLabelRequired: boolean;
    deepfakeDisclosureRequired: boolean;
    euDataResidency: boolean;
    enforcementActive: boolean;
  };
  createdAt: string;
  candidates: ProviderCandidate[];
  rejectedCandidates: ProviderCandidate[];
  policySnapshot: RoutingPolicyConfig;
  scoreBreakdown?: SmartScoreBreakdown;
};

export type RoutingNoEligibleErrorDetail = {
  code: "ROUTING_NO_ELIGIBLE_PROVIDER";
  exclusionSummary: { provider: string; model: string; reasons: string[] }[];
  policySummary: RoutingPolicyConfig;
  requestedCapability: RequestCapability;
  requiredRegion: string | null;
  blockedProviders: string[];
};

export type AnalyzeRequestInput = {
  requestId: string;
  organizationId?: string | null;
  projectId?: string | null;
  apiKeyId: string;
  apiKeyMetadata?: unknown;
  userCountry?: string | null;
  requestedModel: string;
  preferredProvider?: string | null;
  messages?: { role: string; content: string }[];
  capability?: RequestCapability;
  region?: string | null;
  euOnly?: boolean;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  expectedLatencyTier?: LatencyTier;
  optimizationMode?: OptimizationMode;
  streamingRequired?: boolean;
  fallbackAllowed?: boolean;
  excludedProviders?: string[];
  preferredProviders?: string[];
  metadata?: Record<string, unknown>;
  routingPolicyId?: string | null;
};
