import { prisma } from "../prisma";
import { getComplianceForModel } from "../compliance/ai-compliance";
import { getTransparencyEnforcementDate } from "./policy-config";
import { analyzeRequest } from "./request-analyzer";
import { buildProviderCandidates } from "./provider-candidate-builder";
import {
  buildDecisionReasons,
  scoreSmartCandidates,
  selectTopSmartCandidate,
} from "./scoring-engine";
import type { AnalyzeRequestInput, SmartRoutingDecision } from "./routing-types";
import { RoutingNoEligibleError } from "./routing-errors";
import type { MarginContext } from "../billing/margin-engine";

export async function resolveComplianceFlags(providerModelId: string, capability: string) {
  const profile = await getComplianceForModel(providerModelId);
  const enforcement = new Date() >= getTransparencyEnforcementDate();
  const mediaCap = ["image", "audio", "video"].includes(capability);
  return {
    transparencyRequired: profile?.transparencyRequired ?? enforcement,
    aiGeneratedLabelRequired: profile?.aiGeneratedLabelRequired ?? true,
    deepfakeDisclosureRequired:
      profile?.deepfakeDisclosureRequired ?? (mediaCap && enforcement),
    euDataResidency: profile?.gdpr?.euDataResidency ?? false,
    enforcementActive: enforcement,
  };
}

export async function routeSmartRequest(
  input: AnalyzeRequestInput,
  marginCtx?: MarginContext,
  simulate = false,
): Promise<SmartRoutingDecision> {
  const context = await analyzeRequest(input);
  const { eligible, rejected } = await buildProviderCandidates(context, marginCtx);

  const scored = scoreSmartCandidates(eligible, context.optimizationMode, {
    preferredProvider: context.preferredProvider,
    preferredProviders: context.preferredProviders,
  });

  const winner = selectTopSmartCandidate(scored);
  if (!winner) {
    throw new RoutingNoEligibleError({
      code: "ROUTING_NO_ELIGIBLE_PROVIDER",
      exclusionSummary: rejected.map((r) => ({
        provider: r.providerSlug,
        model: r.modelId,
        reasons: r.exclusionReasons,
      })),
      policySummary: context.policy,
      requestedCapability: context.capability,
      requiredRegion: context.region ?? null,
      blockedProviders: context.policy.blockedProviders,
    });
  }

  const reasons = buildDecisionReasons(winner, context.optimizationMode);
  if (context.preferredProvider === winner.providerSlug) {
    reasons.unshift("Preferred provider matched");
  }
  if (context.streamingRequired) {
    reasons.push("Streaming capability required");
  }

  const complianceFlags = await resolveComplianceFlags(winner.providerModelId, context.capability);

  const decision: SmartRoutingDecision = {
    requestId: context.requestId,
    selectedProviderId: winner.providerId,
    selectedProviderName: winner.providerName,
    selectedProviderSlug: winner.providerSlug,
    selectedModelId: winner.modelId,
    selectedModelName: winner.modelName,
    selectedProviderModelId: winner.providerModelId,
    totalScore: winner.totalScore,
    estimatedCostEur: winner.estimatedRequestCostEur,
    estimatedCustomerChargeCredits: winner.estimatedCustomerChargeCredits,
    estimatedLatencyMs: winner.latencyP50,
    selectedRegion: winner.region,
    optimizationMode: context.optimizationMode,
    decisionReasons: simulate ? [`[SIMULATOR] ${reasons.join("; ")}`] : reasons,
    candidateCount: eligible.length,
    rejectedCandidateCount: rejected.length,
    fallbackChain: [winner.providerSlug],
    complianceFlags,
    createdAt: new Date().toISOString(),
    candidates: scored,
    rejectedCandidates: rejected,
    policySnapshot: context.policy,
    scoreBreakdown: winner.scoreBreakdown,
  };

  if (!simulate) {
    await logSmartRoutingDecision(context, decision);
  }

  return decision;
}

async function logSmartRoutingDecision(
  context: Awaited<ReturnType<typeof analyzeRequest>>,
  decision: SmartRoutingDecision,
) {
  try {
    await prisma.auditLog.create({
      data: {
        action: "smart_routing_decision",
        category: "AI_REQUEST",
        detail: {
          requestId: decision.requestId,
          organizationId: context.organizationId,
          projectId: context.projectId,
          selectedProvider: decision.selectedProviderSlug,
          selectedModel: decision.selectedModelId,
          optimizationMode: decision.optimizationMode,
          totalScore: decision.totalScore,
          estimatedCost: decision.estimatedCostEur,
          candidateCount: decision.candidateCount,
          rejectedCandidateCount: decision.rejectedCandidateCount,
          decisionReasons: decision.decisionReasons,
          policySnapshot: decision.policySnapshot,
          complianceFlags: decision.complianceFlags,
          rejectedSummary: decision.rejectedCandidates.slice(0, 10).map((r) => ({
            provider: r.providerSlug,
            model: r.modelId,
            reasons: r.exclusionReasons,
          })),
        },
      },
    });
  } catch {
    // non-fatal
  }
}

export async function simulateSmartRouting(input: AnalyzeRequestInput, marginCtx?: MarginContext) {
  return routeSmartRequest(input, marginCtx, true);
}
