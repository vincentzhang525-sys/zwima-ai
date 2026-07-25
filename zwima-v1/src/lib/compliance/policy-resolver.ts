import { prisma } from "../prisma";
import type { CompliancePolicy, HumanReviewMode, TransparencyLevel } from "@prisma/client";
import { classifyRisk } from "./risk-classifier";
import type { PolicyResolutionInput, PolicyResolutionResult, ResolvedCompliancePolicy } from "./types";

const REVIEW_MODE_RANK: Record<HumanReviewMode, number> = {
  NONE: 0,
  OPTIONAL: 1,
  REQUIRED: 2,
  MANDATORY: 3,
};

const TRANSPARENCY_RANK: Record<TransparencyLevel, number> = {
  NONE: 0,
  BASIC: 1,
  STANDARD: 2,
  ENHANCED: 3,
};

function strictestReviewMode(a: HumanReviewMode, b: HumanReviewMode): HumanReviewMode {
  return REVIEW_MODE_RANK[a] >= REVIEW_MODE_RANK[b] ? a : b;
}

function strictestTransparency(a: TransparencyLevel, b: TransparencyLevel): TransparencyLevel {
  return TRANSPARENCY_RANK[a] >= TRANSPARENCY_RANK[b] ? a : b;
}

function toResolvedPolicy(row: CompliancePolicy, scope: ResolvedCompliancePolicy["scope"]): ResolvedCompliancePolicy {
  return {
    policyId: row.id,
    policyVersion: row.version,
    scope,
    riskCategoryDefault: row.riskCategoryDefault,
    reviewModeDefault: row.reviewModeDefault,
    transparencyLevelDefault: row.transparencyLevelDefault,
    requireAiNotice: row.requireAiNotice,
    requireGeneratedContentFlag: row.requireGeneratedContentFlag,
    requireHumanReview: row.requireHumanReview,
    requireEuProcessing: row.requireEuProcessing,
    allowCrossBorderTransfer: row.allowCrossBorderTransfer,
    allowedRegions: row.allowedRegions,
    blockedProviders: row.blockedProviders,
    blockedModels: row.blockedModels,
    retentionDays: row.retentionDays,
    storePromptHash: row.storePromptHash,
    storeResponseHash: row.storeResponseHash,
    storeTokenMetadata: row.storeTokenMetadata,
    storeCostMetadata: row.storeCostMetadata,
  };
}

async function findActivePolicy(where: { organizationId: string | null; workspaceId: string | null }) {
  return prisma.compliancePolicy.findFirst({
    where: { ...where, status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
  });
}

/**
 * Fallback chain: Workspace-scoped policy → Organization-scoped policy →
 * Platform-wide default policy. The first ACTIVE policy found wins (no
 * merging across scopes, so a workspace override is fully authoritative).
 */
export async function findCompliancePolicyForScope(
  organizationId: string,
  workspaceId?: string | null,
): Promise<{ row: CompliancePolicy; scope: ResolvedCompliancePolicy["scope"] } | null> {
  if (workspaceId) {
    const workspacePolicy = await findActivePolicy({ organizationId, workspaceId });
    if (workspacePolicy) return { row: workspacePolicy, scope: "workspace" };
  }

  const orgPolicy = await findActivePolicy({ organizationId, workspaceId: null });
  if (orgPolicy) return { row: orgPolicy, scope: "organization" };

  const platformPolicy = await findActivePolicy({ organizationId: null, workspaceId: null });
  if (platformPolicy) return { row: platformPolicy, scope: "platform" };

  return null;
}

/** Safe hardcoded fallback used only if no CompliancePolicy row exists at all (e.g. before seeding). */
export const HARDCODED_SAFE_DEFAULT_POLICY: ResolvedCompliancePolicy = {
  policyId: "hardcoded-safe-default",
  policyVersion: "0.0.0-unseeded",
  scope: "platform",
  riskCategoryDefault: "LIMITED",
  reviewModeDefault: "OPTIONAL",
  transparencyLevelDefault: "BASIC",
  requireAiNotice: true,
  requireGeneratedContentFlag: true,
  requireHumanReview: false,
  requireEuProcessing: false,
  allowCrossBorderTransfer: true,
  allowedRegions: [],
  blockedProviders: [],
  blockedModels: [],
  retentionDays: 365,
  storePromptHash: true,
  storeResponseHash: true,
  storeTokenMetadata: true,
  storeCostMetadata: true,
};

async function resolveLatestActiveDisclaimerVersion(locale = "en"): Promise<string | null> {
  const disclaimer = await prisma.complianceDisclaimerVersion.findFirst({
    where: { locale, status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
    select: { version: true },
  });
  return disclaimer?.version ?? null;
}

export async function resolveCompliancePolicy(input: PolicyResolutionInput): Promise<PolicyResolutionResult> {
  const found = await findCompliancePolicyForScope(input.organizationId, input.workspaceId ?? null);
  const policy = found ? toResolvedPolicy(found.row, found.scope) : HARDCODED_SAFE_DEFAULT_POLICY;

  const classification = classifyRisk({
    provider: input.provider,
    model: input.model,
  });

  const risk = input.riskCategory ?? classification.riskCategory;
  const reviewMode = strictestReviewMode(
    strictestReviewMode(policy.reviewModeDefault, classification.reviewMode),
    policy.requireHumanReview ? "REQUIRED" : "NONE",
  );
  const transparency = strictestTransparency(policy.transparencyLevelDefault, classification.transparencyLevel);

  const providerBlocked = policy.blockedProviders.includes(input.provider);
  const modelBlocked = policy.blockedModels.includes(input.model);
  const prohibited = risk === "PROHIBITED";

  const allowed = !providerBlocked && !modelBlocked && !prohibited;
  const blockReason = prohibited
    ? "Request classified as a prohibited AI practice under the EU AI Act and cannot be processed."
    : providerBlocked
      ? `Provider "${input.provider}" is blocked by the active compliance policy.`
      : modelBlocked
        ? `Model "${input.model}" is blocked by the active compliance policy.`
        : null;

  const disclaimerVersion = await resolveLatestActiveDisclaimerVersion("en");

  return {
    policy,
    policyVersion: policy.policyVersion,
    risk,
    reviewMode,
    transparency,
    allowed,
    blockReason,
    regions: policy.allowedRegions,
    disclaimerVersion,
  };
}
