import { prisma } from "../prisma";
import { parseProviderConfig } from "../providers/provider-admin-config";
import { estimateCost } from "../pricing/pricing-service";
import { loadLifecyclePolicyIndex } from "../model-lifecycle/policy-loader";
import {
  lookupPolicies,
  resolveLifecycleRoutingDecision,
} from "../model-lifecycle/policy-wiring";
import type { MarginContext } from "../billing/margin-engine";
import type { ProviderCandidate, RoutingRequestContext } from "./routing-types";

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function qualityTierScore(tier: string): number {
  const map: Record<string, number> = {
    ECONOMY: 40,
    STANDARD: 60,
    PREMIUM: 80,
    FLAGSHIP: 95,
  };
  return map[tier] ?? 55;
}

function exclude(c: ProviderCandidate, reason: string): ProviderCandidate {
  return {
    ...c,
    excluded: true,
    exclusionReasons: [...c.exclusionReasons, reason],
  };
}

export async function buildProviderCandidates(
  context: RoutingRequestContext,
  marginCtx?: MarginContext,
): Promise<{ eligible: ProviderCandidate[]; rejected: ProviderCandidate[] }> {
  const now = new Date();
  const normalizedModel = context.requestedModel.toLowerCase();
  const policyIndex = await loadLifecyclePolicyIndex();
  const providers = await prisma.provider.findMany({
    include: {
      health: true,
      models: {
        include: {
          replacementModel: { select: { modelCode: true, displayName: true } },
          pricing: {
            where: {
              pricingStatus: "VERIFIED",
              effectiveFrom: { lte: now },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
            },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const eligible: ProviderCandidate[] = [];
  const rejected: ProviderCandidate[] = [];

  for (const p of providers) {
    const config = parseProviderConfig(p.config);
    const hasApiKey =
      (config.apiKeys ?? []).some((k) => k.enabled && (k.secret || k.masked)) ||
      Boolean(process.env[`${p.slug.toUpperCase()}_API_KEY`]);
    const supportedRegions = config.regions ?? (p.region ? [p.region] : []);
    const supportsEmbedding = config.capabilities?.embedding ?? false;

    for (const m of p.models) {
      const pricing = m.pricing[0];
      const c: ProviderCandidate = {
        providerId: p.id,
        providerName: p.name,
        providerSlug: p.slug,
        modelId: m.modelCode,
        modelName: m.displayName,
        providerModelId: m.id,
        enabled: p.enabled,
        providerStatus: p.status,
        modelStatus: m.status,
        region: p.region,
        supportedRegions,
        supportsStreaming: p.supportsStreaming || m.supportsStreaming,
        supportsEmbedding: supportsEmbedding || m.modelType === "EMBEDDING",
        supportsImage: m.modelType === "IMAGE",
        supportsAudio: m.modelType === "AUDIO",
        supportsVideo: false,
        inputPrice: pricing ? num(pricing.inputPricePerMillionTokens) : 0,
        outputPrice: pricing ? num(pricing.outputPricePerMillionTokens) : 0,
        cacheReadPrice: pricing ? num(pricing.cachedInputPricePerMillionTokens) : 0,
        cacheWritePrice: pricing ? num(pricing.cacheWritePricePerMillionTokens) : 0,
        estimatedRequestCostEur: 0,
        estimatedCustomerChargeCredits: 0,
        latencyP50: p.health?.latencyP50 ?? p.lastLatency ?? null,
        latencyP95: p.health?.latencyP95 ?? null,
        successRate: p.health?.successRate ? num(p.health.successRate) * 100 : 99,
        errorRate: p.health?.errorRate ? num(p.health.errorRate) * 100 : 1,
        qualityScore: qualityTierScore(m.qualityTier),
        routingPriority: p.priority,
        routingWeight: p.weight,
        promotionActive: pricing?.promotionActive ?? false,
        promotionEndDate:
          pricing?.promotionEndDate && pricing.promotionEndDate > now
            ? pricing.promotionEndDate.toISOString()
            : null,
        euCompliant:
          m.euAvailable &&
          (p.dataResidency?.toUpperCase() === "EU" || p.region?.toUpperCase() === "EU"),
        dataResidencyRegions: p.dataResidency ? [p.dataResidency] : supportedRegions,
        hasApiKey,
        excluded: false,
        exclusionReasons: [],
        totalScore: 0,
      };

      const pushRejected = (reason: string) => rejected.push(exclude(c, reason));

      if (!p.enabled) {
        pushRejected("Provider disabled");
        continue;
      }
      if (p.status !== "ACTIVE") {
        pushRejected(`Provider status ${p.status}`);
        continue;
      }
      if (p.health?.status === "DOWN") {
        pushRejected("Provider health DOWN");
        continue;
      }

      const { deprecationPolicy, migrationPolicy } = lookupPolicies(policyIndex, p.slug, m.modelCode);
      const lifecycle = resolveLifecycleRoutingDecision({
        modelStatus: m.status,
        modelCode: m.modelCode,
        vercelEnv: process.env.VERCEL_ENV,
        now,
        modelDeprecationDate: m.deprecationDate,
        modelReplacementCode: m.replacementModel?.modelCode ?? null,
        deprecationPolicy,
        migrationPolicy,
      });
      if (!lifecycle.routable) {
        pushRejected(lifecycle.exclusionReason ?? `Model status ${m.status} not routable`);
        continue;
      }
      if (lifecycle.migrationApplied && lifecycle.effectiveModelCode) {
        c.modelId = lifecycle.effectiveModelCode;
      }

      if (m.modelCode.toLowerCase() !== normalizedModel && !context.requestedModel.includes("*")) {
        pushRejected("Model mismatch");
        continue;
      }
      if (!matchCapability(context.capability, c)) {
        pushRejected(`Capability ${context.capability} not supported`);
        continue;
      }
      if (context.streamingRequired && !c.supportsStreaming) {
        pushRejected("Streaming required but not supported");
        continue;
      }
      if (context.euOnly && !c.euCompliant) {
        pushRejected("EU compliance required");
        continue;
      }
      if (context.region && c.region && c.region.toUpperCase() !== context.region.toUpperCase()) {
        pushRejected(`Region mismatch: requires ${context.region}`);
        continue;
      }
      if (context.policy.allowedRegions.length) {
        const ok = context.policy.allowedRegions.some((r) =>
          supportedRegions.some((sr) => sr.toUpperCase() === r.toUpperCase()),
        );
        if (!ok) {
          pushRejected("Not in allowed regions");
          continue;
        }
      }
      if (context.policy.allowedProviders.length && !context.policy.allowedProviders.includes(p.slug)) {
        pushRejected("Provider not in allowed list");
        continue;
      }
      if (context.policy.blockedProviders.includes(p.slug) || context.excludedProviders.includes(p.slug)) {
        pushRejected("Provider blocked by policy");
        continue;
      }
      if (context.preferredProvider === p.slug && context.policy.blockedProviders.includes(p.slug)) {
        pushRejected("Preferred provider blocked by policy");
        continue;
      }
      if (context.policy.requireDataResidency && !c.dataResidencyRegions.length) {
        pushRejected("Data residency required");
        continue;
      }
      if (!hasApiKey) {
        pushRejected("No provider API key configured");
        continue;
      }

      const cost = await estimateCost({
        providerSlug: p.slug,
        modelCode: m.modelCode,
        inputTokens: context.estimatedInputTokens,
        outputTokens: context.estimatedOutputTokens,
        marginCtx,
      });
      c.estimatedRequestCostEur = cost.providerCostEur;
      c.estimatedCustomerChargeCredits = cost.customerChargeCredits;

      if (
        context.policy.maxCostPerRequestEur != null &&
        c.estimatedRequestCostEur > context.policy.maxCostPerRequestEur
      ) {
        pushRejected("Exceeds max cost per request");
        continue;
      }
      if (
        context.policy.maxLatencyMs != null &&
        c.latencyP50 != null &&
        c.latencyP50 > context.policy.maxLatencyMs
      ) {
        pushRejected("Exceeds max latency");
        continue;
      }
      if (c.qualityScore < context.policy.minimumQualityScore) {
        pushRejected("Below minimum quality score");
        continue;
      }

      eligible.push(c);
    }
  }

  return applyPreferredProviderFilter(context, eligible, rejected);
}

function matchCapability(cap: string, c: ProviderCandidate): boolean {
  switch (cap) {
    case "embedding":
      return c.supportsEmbedding;
    case "image":
      return c.supportsImage;
    case "audio":
      return c.supportsAudio;
    case "video":
      return c.supportsVideo;
    default:
      return true;
  }
}

export function applyPreferredProviderFilter(
  context: RoutingRequestContext,
  eligible: ProviderCandidate[],
  rejected: ProviderCandidate[],
): { eligible: ProviderCandidate[]; rejected: ProviderCandidate[] } {
  if (!context.preferredProvider || !context.metadata.strictPreferredProvider) {
    return { eligible, rejected };
  }
  if (context.policy.blockedProviders.includes(context.preferredProvider)) {
    return { eligible: [], rejected };
  }
  const preferred = eligible.filter((c) => c.providerSlug === context.preferredProvider);
  const rest = eligible.filter((c) => c.providerSlug !== context.preferredProvider);
  for (const r of rest) {
    rejected.push(exclude(r, "Strict preferred provider mode"));
  }
  return { eligible: preferred, rejected };
}
