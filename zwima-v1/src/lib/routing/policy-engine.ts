import { prisma } from "../prisma";
import type { RoutingStrategy } from "@prisma/client";
import { buildCandidates } from "./candidate-builder";
import { scoreCandidates, selectTopCandidate } from "./scoring-engine";
import type { RoutingDecision, RoutingInput, RoutingWeights } from "./routing-types";
import { RoutingError } from "./routing-errors";
import type { MarginContext } from "../billing/margin-engine";

async function loadWeights(): Promise<RoutingWeights> {
  const row = await prisma.routingWeightConfig.findFirst({ where: { name: "default" } });
  if (!row) {
    return { costWeight: 0.3, latencyWeight: 0.25, qualityWeight: 0.2, reliabilityWeight: 0.15, regionWeight: 0.1 };
  }
  return {
    costWeight: Number(row.costWeight),
    latencyWeight: Number(row.latencyWeight),
    qualityWeight: Number(row.qualityWeight),
    reliabilityWeight: Number(row.reliabilityWeight),
    regionWeight: Number(row.regionWeight),
  };
}

async function resolvePolicy(input: RoutingInput): Promise<{
  strategy: RoutingStrategy;
  policyId?: string;
  allowedProviders: string[];
  blockedProviders: string[];
  allowedModels: string[];
  blockedModels: string[];
  requiredRegion?: string | null;
  maximumCost?: number | null;
  fallbackEnabled: boolean;
  maxRetries: number;
}> {
  let policy = null;
  if (input.routingPolicyId) {
    policy = await prisma.routingPolicy.findUnique({ where: { id: input.routingPolicyId } });
  } else if (input.organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (org?.defaultRoutingPolicyId) {
      policy = await prisma.routingPolicy.findUnique({ where: { id: org.defaultRoutingPolicyId } });
    }
    if (!policy) {
      policy = await prisma.routingPolicy.findFirst({
        where: { organizationId: input.organizationId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      });
    }
  }
  if (!policy) {
    policy = await prisma.routingPolicy.findFirst({
      where: { organizationId: null, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
  }

  const strategy = input.strategy ?? policy?.strategy ?? "BALANCED";

  return {
    strategy,
    policyId: policy?.id,
    allowedProviders: [
      ...(policy?.allowedProviders ?? []),
      ...(input.allowedProviders ?? []),
    ].filter(Boolean),
    blockedProviders: [...(policy?.blockedProviders ?? []), ...(input.blockedProviders ?? [])],
    allowedModels: [...(policy?.allowedModels ?? []), ...(input.allowedModels ?? [])].filter(Boolean),
    blockedModels: [...(policy?.blockedModels ?? []), ...(input.blockedModels ?? [])],
    requiredRegion: input.requiredRegion ?? policy?.requiredRegion,
    maximumCost: input.maximumCost ?? (policy?.maximumCostPerRequest ? Number(policy.maximumCostPerRequest) * 1000 : null),
    fallbackEnabled: policy?.fallbackEnabled ?? true,
    maxRetries: policy?.maxRetries ?? 2,
  };
}

export async function routeRequest(
  input: RoutingInput,
  marginCtx?: MarginContext,
  simulate = false
): Promise<RoutingDecision> {
  const policy = await resolvePolicy(input);
  const enrichedInput: RoutingInput = {
    ...input,
    allowedProviders: policy.allowedProviders.length ? policy.allowedProviders : input.allowedProviders,
    blockedProviders: policy.blockedProviders,
    allowedModels: policy.allowedModels.length ? policy.allowedModels : input.allowedModels,
    blockedModels: policy.blockedModels,
    requiredRegion: policy.requiredRegion,
    maximumCost: policy.maximumCost,
    strategy: policy.strategy,
  };

  const { candidates, excluded } = await buildCandidates(enrichedInput, marginCtx);
  const weights = await loadWeights();
  scoreCandidates(candidates, policy.strategy, weights, policy.requiredRegion);

  const selected = selectTopCandidate(candidates);
  if (!selected) {
    throw new RoutingError(
      `No eligible provider for model "${input.requestedModel}". Excluded: ${excluded.map((e) => `${e.providerSlug}/${e.modelCode}: ${e.exclusionReason}`).join("; ")}`
    );
  }

  const reason = simulate
    ? `[SIMULATOR] Selected ${selected.providerSlug}/${selected.modelCode} via ${policy.strategy} (score ${selected.scores?.total?.toFixed(3)})`
    : `Selected ${selected.providerSlug}/${selected.modelCode} via ${policy.strategy} (score ${selected.scores?.total?.toFixed(3)})`;

  return {
    selected,
    candidates,
    excluded,
    strategy: policy.strategy,
    policyId: policy.policyId,
    routingReason: reason,
    estimatedCost: selected.estimatedProviderCostEur,
    estimatedCustomerCharge: selected.estimatedCustomerCharge,
    estimatedMarginPercent: selected.estimatedMarginPercent,
    fallbackCount: 0,
    attemptedProviders: [selected.providerSlug],
  };
}

export async function simulateRouting(input: RoutingInput, marginCtx?: MarginContext) {
  return routeRequest(input, marginCtx, true);
}
