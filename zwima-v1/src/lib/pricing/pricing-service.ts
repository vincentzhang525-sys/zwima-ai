import { prisma } from "../prisma";
import { getEffectiveMultiplier, applyMargin, type MarginContext } from "../billing/margin-engine";
import { estimateCostV2 } from "../cost/cost-calculator-v2";
import { isRoutableStatus } from "../model-lifecycle/lifecycle-service";

export type ActivePricing = {
  id: string;
  providerModelId: string;
  providerSlug: string;
  modelCode: string;
  /** Provider list currency (M4 extended Currency enum: EUR/USD/GBP/CNY/…) */
  currency: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  platformMarkupPercent: number;
  pricingStatus: string;
};

function toNum(v: unknown): number {
  return Number(v);
}

/** Current VERIFIED pricing for a model at a given time. DRAFT/EXPIRED excluded. */
export async function getActivePricing(
  providerSlug: string,
  modelCode: string,
  at: Date = new Date()
): Promise<ActivePricing | null> {
  const provider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
  if (!provider) return null;

  const model = await prisma.providerModel.findUnique({
    where: { providerId_modelCode: { providerId: provider.id, modelCode } },
  });
  if (!model || !isRoutableStatus(model.status, process.env.VERCEL_ENV)) return null;

  const record = await prisma.modelPricingRecord.findFirst({
    where: {
      providerModelId: model.id,
      pricingStatus: "VERIFIED",
      effectiveFrom: { lte: at },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!record) return null;

  const inputPrice = toNum(record.inputPricePerMillionTokens);
  const outputPrice = toNum(record.outputPricePerMillionTokens);
  if (inputPrice <= 0 || outputPrice <= 0) return null;

  return {
    id: record.id,
    providerModelId: model.id,
    providerSlug,
    modelCode,
    currency: record.currency,
    inputPricePerMillion: toNum(record.inputPricePerMillionTokens),
    outputPricePerMillion: toNum(record.outputPricePerMillionTokens),
    platformMarkupPercent: toNum(record.platformMarkupPercent),
    pricingStatus: record.pricingStatus,
  };
}

export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const row = await prisma.exchangeRate.findUnique({
    where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
  });
  return row ? toNum(row.rate) : 1;
}

export type CostEstimate = {
  providerCostEur: number;
  customerChargeCredits: number;
  platformMarginEur: number;
  marginPercent: number;
  inputTokens: number;
  outputTokens: number;
  currency: string;
  exchangeRate: number;
  pricingVersionId?: string;
};

export async function estimateCost(params: {
  providerSlug: string;
  modelCode: string;
  inputTokens: number;
  outputTokens: number;
  marginCtx?: MarginContext;
}): Promise<CostEstimate> {
  const v2 = await estimateCostV2({
    providerSlug: params.providerSlug,
    modelCode: params.modelCode,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
  });

  if (v2) {
    const multiplier = await getEffectiveMultiplier({
      providerSlug: params.providerSlug,
      modelId: params.modelCode,
      ...params.marginCtx,
    });
    const withMargin = applyMargin(v2.customerPriceEur, multiplier);
    const customerEur = Math.max(withMargin, v2.suggestedSellingPriceEur);
    const customerChargeCredits = Math.max(1, Math.ceil(customerEur * 1000));
    const platformMarginEur = customerEur - v2.providerCostEur;
    const marginPercent =
      v2.providerCostEur > 0 ? (platformMarginEur / v2.providerCostEur) * 100 : v2.marginPercent;

    return {
      providerCostEur: v2.providerCostEur,
      customerChargeCredits,
      platformMarginEur,
      marginPercent,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      currency: v2.currency,
      exchangeRate: 1,
      pricingVersionId: v2.pricingRecordId ?? undefined,
    };
  }

  const active = await getActivePricing(params.providerSlug, params.modelCode);

  if (active) {
    const rate = active.currency === "USD" ? await getExchangeRate("USD", "EUR") : 1;
    const inputCost =
      (params.inputTokens / 1_000_000) * active.inputPricePerMillion * rate;
    const outputCost =
      (params.outputTokens / 1_000_000) * active.outputPricePerMillion * rate;
    const providerCostEur = inputCost + outputCost;

    const multiplier = await getEffectiveMultiplier({
      providerSlug: params.providerSlug,
      modelId: params.modelCode,
      ...params.marginCtx,
    });
    const withMargin = applyMargin(providerCostEur, multiplier);
    const markupMult = 1 + active.platformMarkupPercent / 100;
    const customerEur = Math.max(withMargin, providerCostEur * markupMult);
    const customerChargeCredits = Math.max(1, Math.ceil(customerEur * 1000));
    const platformMarginEur = customerEur - providerCostEur;
    const marginPercent = providerCostEur > 0 ? (platformMarginEur / providerCostEur) * 100 : 0;

    return {
      providerCostEur,
      customerChargeCredits,
      platformMarginEur,
      marginPercent,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      currency: "EUR",
      exchangeRate: rate,
      pricingVersionId: active.id,
    };
  }

  // Legacy fallback
  const { calculateUsageCredits } = await import("../billing/pricing-engine");
  const legacy = await calculateUsageCredits({
    providerSlug: params.providerSlug,
    modelId: params.modelCode,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    marginCtx: params.marginCtx,
  });

  const customerEur = legacy.customerCredits / 1000;
  const platformMarginEur = customerEur - legacy.providerCost;
  const marginPercent = legacy.providerCost > 0 ? (platformMarginEur / legacy.providerCost) * 100 : 0;

  return {
    providerCostEur: legacy.providerCost,
    customerChargeCredits: legacy.customerCredits,
    platformMarginEur,
    marginPercent,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    currency: "EUR",
    exchangeRate: 1,
  };
}

export async function listVerifiedModels() {
  const env = process.env.VERCEL_ENV;
  const statuses = env === "preview" ? (["ACTIVE", "PREVIEW"] as const) : (["ACTIVE"] as const);
  return prisma.providerModel.findMany({
    where: { status: { in: [...statuses] } },
    include: {
      provider: true,
      pricing: {
        where: {
          pricingStatus: "VERIFIED",
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });
}
