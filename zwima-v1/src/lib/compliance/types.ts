import type {
  AIEventStatus,
  ComplianceEnvironmentType,
  ComplianceEventSource,
  ComplianceRiskCategory,
  ComplianceTaskType,
  HumanReviewMode,
  HumanReviewPriority,
  HumanReviewStatus,
  TransparencyLevel,
} from "@prisma/client";

/**
 * V1.1 M6 Runtime EU AI Act Compliance Center — shared domain types.
 *
 * This module is intentionally free of Prisma calls so it can be imported
 * by both server code and pure unit tests without pulling in a DB client.
 */

export type SupportedLocale = "en" | "de" | "zh";

export const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "de", "zh"];

export type CompliancePolicyScope = {
  organizationId: string | null;
  workspaceId: string | null;
};

export type ResolvedCompliancePolicy = {
  policyId: string;
  policyVersion: string;
  scope: "workspace" | "organization" | "platform";
  riskCategoryDefault: ComplianceRiskCategory;
  reviewModeDefault: HumanReviewMode;
  transparencyLevelDefault: TransparencyLevel;
  requireAiNotice: boolean;
  requireGeneratedContentFlag: boolean;
  requireHumanReview: boolean;
  requireEuProcessing: boolean;
  allowCrossBorderTransfer: boolean;
  allowedRegions: string[];
  blockedProviders: string[];
  blockedModels: string[];
  retentionDays: number;
  storePromptHash: boolean;
  storeResponseHash: boolean;
  storeTokenMetadata: boolean;
  storeCostMetadata: boolean;
};

export type PolicyResolutionInput = {
  organizationId: string;
  workspaceId?: string | null;
  provider: string;
  model: string;
  riskCategory?: ComplianceRiskCategory;
};

export type PolicyResolutionResult = {
  policy: ResolvedCompliancePolicy;
  policyVersion: string;
  risk: ComplianceRiskCategory;
  reviewMode: HumanReviewMode;
  transparency: TransparencyLevel;
  allowed: boolean;
  blockReason: string | null;
  regions: string[];
  disclaimerVersion: string | null;
};

export type RiskClassificationInput = {
  provider: string;
  model: string;
  taskType?: ComplianceTaskType;
  requestType?: string;
  /** Free-text tags describing the use case (e.g. "biometric", "credit_scoring"). */
  useCaseTags?: string[];
  /** Whether the caller has already flagged this as a prohibited practice. */
  prohibitedOverride?: boolean;
};

export type RiskClassificationResult = {
  riskCategory: ComplianceRiskCategory;
  reviewMode: HumanReviewMode;
  transparencyLevel: TransparencyLevel;
  reasons: string[];
  blocked: boolean;
};

export type RegionPickInput = {
  provider: string;
  requireEuProcessing?: boolean;
  allowedRegions?: string[];
  preferredRegionCode?: string | null;
};

export type RegionPickResult = {
  regionCode: string | null;
  isEuEea: boolean;
  crossBorderTransfer: boolean;
  reason: string;
};

export type RecordAIEventInput = {
  eventId?: string;
  requestId: string;
  correlationId?: string;
  idempotencyKey?: string | null;
  organizationId: string;
  workspaceId?: string | null;
  userId?: string | null;
  apiKeyId?: string | null;
  projectId?: string | null;
  parentEventId?: string | null;
  workflowRunId?: string | null;
  agentRunId?: string | null;
  stepId?: string | null;

  provider: string;
  model: string;
  modelVersion?: string;
  requestedModel?: string | null;
  resolvedModel?: string | null;
  migrationReason?: string | null;
  migrationPolicyId?: string | null;
  registryEntryId?: string | null;
  priceVersionId?: string | null;
  costProfileId?: string | null;

  taskType?: ComplianceTaskType;
  requestType?: string;
  eventSource?: ComplianceEventSource;
  environment?: ComplianceEnvironmentType;

  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  toolCallCount?: number;
  retryCount?: number;
  latencyMs?: number | null;

  status?: AIEventStatus;
  errorCode?: string | null;
  errorCategory?: string | null;

  /**
   * Explicit region overrides. When omitted, `processingRegion` is derived
   * from `pickProcessingRegion` (provider capability + active policy);
   * `inferenceRegion`/`dataResidencyRegion`/`providerRegion` default to the
   * resolved processing region unless independently specified.
   */
  processingRegion?: string | null;
  inferenceRegion?: string | null;
  dataResidencyRegion?: string | null;
  providerRegion?: string | null;

  /** Raw prompt/response text — hashed immediately, never persisted as plaintext. */
  promptText?: string | null;
  responseText?: string | null;

  humanAssisted?: boolean;

  usageLogId?: string | null;
  costCalculationId?: string | null;
  billingTransactionId?: string | null;

  estimatedCost?: number | null;
  actualCost?: number | null;
  grossMargin?: number | null;
  currency?: string;

  occurredAt?: Date;
  completedAt?: Date | null;
};

export type RecordAIEventResult = {
  eventId: string;
  auditId: string;
  riskCategory: ComplianceRiskCategory;
  reviewStatus: HumanReviewStatus;
  reviewMode: HumanReviewMode;
  reviewCaseId: string | null;
  blocked: boolean;
  blockReason: string | null;
  idempotent: boolean;
};

export type HumanReviewDecisionInput = {
  caseId: string;
  toStatus: HumanReviewStatus;
  actorId?: string | null;
  note?: string | null;
};

export type ComplianceReportFormat = "json" | "csv" | "pdf";

export type ComplianceReportFilters = {
  organizationId: string;
  workspaceId?: string | null;
  from?: Date;
  to?: Date;
  riskCategory?: ComplianceRiskCategory;
  reviewStatus?: HumanReviewStatus;
  provider?: string;
  limit?: number;
};

export type { HumanReviewPriority };
