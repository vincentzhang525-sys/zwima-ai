import { prisma } from "../prisma";
import type { RoutingInput, RoutingCandidate } from "./routing-types";
import { estimateCost } from "../pricing/pricing-service";
import type { MarginContext } from "../billing/margin-engine";

function markExcluded(c: RoutingCandidate, reason: string): RoutingCandidate {
  return { ...c, excluded: true, exclusionReason: reason };
}

export async function buildCandidates(
  input: RoutingInput,
  marginCtx?: MarginContext
): Promise<{ candidates: RoutingCandidate[]; excluded: RoutingCandidate[] }> {
  const now = new Date();
  const normalizedModel = input.requestedModel.trim().toLowerCase();

  const providers = await prisma.provider.findMany({
    where: { enabled: true, status: "ACTIVE" },
    include: {
      health: true,
      models: {
        where: { status: "ACTIVE" },
        include: {
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

  const candidates: RoutingCandidate[] = [];
  const excluded: RoutingCandidate[] = [];

  for (const p of providers) {
    for (const m of p.models) {
      let c: RoutingCandidate = {
        providerSlug: p.slug,
        providerId: p.id,
        modelCode: m.modelCode,
        providerModelId: m.id,
        displayName: m.displayName,
        region: p.region,
        dataResidency: p.dataResidency,
        qualityTier: m.qualityTier,
        estimatedProviderCostEur: 0,
        estimatedCustomerCharge: 0,
        estimatedMarginPercent: 0,
        latencyP50: p.health?.latencyP50 ?? p.lastLatency,
        healthStatus: p.health?.status ?? "UNKNOWN",
        pricingRecordId: m.pricing[0]?.id,
      };

      if (m.modelCode.toLowerCase() !== normalizedModel && !input.requestedModel.includes("*")) {
        c = markExcluded(c, "Model mismatch");
        excluded.push(c);
        continue;
      }

      if (input.allowedProviders?.length && !input.allowedProviders.includes(p.slug)) {
        c = markExcluded(c, "Provider not allowed for API key");
        excluded.push(c);
        continue;
      }
      if (input.blockedProviders?.includes(p.slug)) {
        c = markExcluded(c, "Provider blocked by policy");
        excluded.push(c);
        continue;
      }
      if (input.allowedModels?.length && !input.allowedModels.includes(m.modelCode)) {
        c = markExcluded(c, "Model not allowed for API key");
        excluded.push(c);
        continue;
      }
      if (input.blockedModels?.includes(m.modelCode)) {
        c = markExcluded(c, "Model blocked by policy");
        excluded.push(c);
        continue;
      }
      if (input.requiredRegion && p.region && p.region !== input.requiredRegion) {
        c = markExcluded(c, `Region mismatch: requires ${input.requiredRegion}`);
        excluded.push(c);
        continue;
      }
      if (p.health?.status === "DOWN") {
        c = markExcluded(c, "Provider health DOWN");
        excluded.push(c);
        continue;
      }
      if (!m.pricing[0]) {
        const legacyRow = await prisma.modelPricing.findUnique({
          where: { providerSlug_modelId: { providerSlug: p.slug, modelId: m.modelCode } },
        });
        if (!legacyRow) {
          c = markExcluded(c, "No VERIFIED or legacy pricing");
          excluded.push(c);
          continue;
        }
      }

      const cost = await estimateCost({
        providerSlug: p.slug,
        modelCode: m.modelCode,
        inputTokens: input.estimatedInputTokens,
        outputTokens: input.estimatedOutputTokens,
        marginCtx,
      });
      c.estimatedProviderCostEur = cost.providerCostEur;
      c.estimatedCustomerCharge = cost.customerChargeCredits;
      c.estimatedMarginPercent = cost.marginPercent;
      c.pricingRecordId = cost.pricingVersionId;

      if (input.maximumCost != null && c.estimatedCustomerCharge > input.maximumCost) {
        c = markExcluded(c, "Exceeds maximum cost per request");
        excluded.push(c);
        continue;
      }

      candidates.push(c);
    }
  }

  // Legacy adapter fallback when no ProviderModel records match
  if (candidates.length === 0 && excluded.length === 0) {
    const { routeByModel } = await import("../providers/router");
    const routed = await routeByModel(input.requestedModel);
    if (routed) {
      const row = await prisma.provider.findUnique({ where: { slug: routed.adapter.slug } });
      if (row?.enabled) {
        const cost = await estimateCost({
          providerSlug: routed.adapter.slug,
          modelCode: routed.model,
          inputTokens: input.estimatedInputTokens,
          outputTokens: input.estimatedOutputTokens,
          marginCtx,
        });
        candidates.push({
          providerSlug: routed.adapter.slug,
          providerId: row.id,
          modelCode: routed.model,
          providerModelId: "",
          displayName: routed.model,
          qualityTier: "STANDARD",
          estimatedProviderCostEur: cost.providerCostEur,
          estimatedCustomerCharge: cost.customerChargeCredits,
          estimatedMarginPercent: cost.marginPercent,
          healthStatus: row.lastError ? "DEGRADED" : "HEALTHY",
          latencyP50: row.lastLatency,
        });
      }
    }
  }

  return { candidates, excluded };
}
