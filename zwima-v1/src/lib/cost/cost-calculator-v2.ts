import type { ModelPricingRecord } from "@prisma/client";
import { prisma } from "../prisma";
import { getExchangeRate } from "../pricing/pricing-service";

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

export type CostCalculatorV2Input = {
  providerSlug: string;
  modelCode: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  longContextTokens?: number;
  searchToolCalls?: number;
  embeddingTokens?: number;
  imageUnits?: number;
  audioUnits?: number;
  videoUnits?: number;
  batchMode?: boolean;
  retryCount?: number;
  at?: Date;
};

export type CostCalculatorV2Result = {
  providerCostEur: number;
  customerPriceEur: number;
  suggestedSellingPriceEur: number;
  suggestedSellingPriceCredits: number;
  platformMarginEur: number;
  marginPercent: number;
  breakdown: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    longContext: number;
    searchTool: number;
    embedding: number;
    image: number;
    audio: number;
    video: number;
    batchDiscountApplied: number;
    retrySurcharge: number;
  };
  pricingRecordId: string | null;
  effectiveFrom: string | null;
  promotionEndDate: string | null;
  platformMarkupPercent: number;
  currency: string;
};

export async function getActivePricingRecord(
  providerSlug: string,
  modelCode: string,
  at: Date = new Date(),
) {
  const provider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
  if (!provider) return null;

  const model = await prisma.providerModel.findUnique({
    where: { providerId_modelCode: { providerId: provider.id, modelCode } },
  });
  if (!model) return null;

  return prisma.modelPricingRecord.findFirst({
    where: {
      providerModelId: model.id,
      pricingStatus: "VERIFIED",
      effectiveFrom: { lte: at },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }],
      AND: [
        {
          OR: [{ promotionEndDate: null }, { promotionEndDate: { gt: at } }],
        },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

export function calculateMarginFromProviderCost(
  providerCostEur: number,
  record: Pick<ModelPricingRecord, "platformMarkupPercent" | "internalCostMultiplier" | "providerDiscount">,
) {
  const markup = num(record.platformMarkupPercent);
  const internalMult = num(record.internalCostMultiplier) || 1;
  const discount = num(record.providerDiscount) || 0;
  const adjustedCost = providerCostEur * internalMult * (1 - discount);
  const customerPriceEur = adjustedCost * (1 + markup / 100);
  const platformMarginEur = customerPriceEur - adjustedCost;
  const marginPercent =
    adjustedCost > 0 ? Math.round((platformMarginEur / adjustedCost) * 10000) / 100 : 0;
  return {
    customerPriceEur,
    suggestedSellingPriceEur: customerPriceEur,
    suggestedSellingPriceCredits: Math.ceil(customerPriceEur * 1000),
    platformMarginEur,
    marginPercent,
    platformMarkupPercent: markup,
  };
}

export function calculateFromRecord(
  record: ModelPricingRecord,
  input: Omit<CostCalculatorV2Input, "providerSlug" | "modelCode" | "at">,
  exchangeRate = 1,
): CostCalculatorV2Result {
  const perM = (tokens: number, pricePerMillion: number) =>
    (tokens / 1_000_000) * pricePerMillion * exchangeRate;
  const perUnit = (units: number, price: number) => units * price * exchangeRate;

  const inputCost = perM(input.inputTokens ?? 0, num(record.inputPricePerMillionTokens));
  const outputCost = perM(input.outputTokens ?? 0, num(record.outputPricePerMillionTokens));
  const cacheRead = perM(input.cachedInputTokens ?? 0, num(record.cachedInputPricePerMillionTokens));
  const cacheWrite = perM(input.cacheWriteTokens ?? 0, num(record.cacheWritePricePerMillionTokens));
  const longContext = perM(
    input.longContextTokens ?? 0,
    num(record.longContextPricePerMillionTokens),
  );
  const embedding = perM(input.embeddingTokens ?? 0, num(record.inputPricePerMillionTokens));
  const searchTool =
    (input.searchToolCalls ?? 0) * num(record.searchToolPricePerRequest) * exchangeRate;
  const image = perUnit(input.imageUnits ?? 0, num(record.imagePrice));
  const audio = perUnit(input.audioUnits ?? 0, num(record.audioPrice));
  const video = perUnit(
    input.videoUnits ?? 0,
    num(record.requestPrice) || num(record.imagePrice) * 2,
  );

  let subtotal =
    inputCost +
    outputCost +
    cacheRead +
    cacheWrite +
    longContext +
    embedding +
    searchTool +
    image +
    audio +
    video;

  let batchDiscountApplied = 0;
  if (input.batchMode && record.batchDiscount) {
    batchDiscountApplied = subtotal * num(record.batchDiscount);
    subtotal -= batchDiscountApplied;
  }

  const retryMult = num(record.retryCostMultiplier) || 1;
  const retries = input.retryCount ?? 0;
  const retrySurcharge = retries > 0 ? subtotal * (retryMult - 1) * retries : 0;
  subtotal += retrySurcharge;

  if (record.minimumCharge) {
    subtotal = Math.max(subtotal, num(record.minimumCharge) * exchangeRate);
  }

  const margin = calculateMarginFromProviderCost(subtotal, record);

  return {
    providerCostEur: subtotal,
    ...margin,
    breakdown: {
      input: inputCost,
      output: outputCost,
      cacheRead,
      cacheWrite,
      longContext,
      searchTool,
      embedding,
      image,
      audio,
      video,
      batchDiscountApplied,
      retrySurcharge,
    },
    pricingRecordId: record.id,
    effectiveFrom: record.effectiveFrom.toISOString(),
    promotionEndDate: record.promotionEndDate?.toISOString() ?? null,
    currency: record.currency,
  };
}

export async function estimateCostV2(input: CostCalculatorV2Input): Promise<CostCalculatorV2Result | null> {
  const at = input.at ?? new Date();
  const record = await getActivePricingRecord(input.providerSlug, input.modelCode, at);
  if (!record) return null;

  const rate = record.currency === "USD" ? await getExchangeRate("USD", "EUR") : 1;
  return calculateFromRecord(record, input, rate);
}

export type PricingRecordV2Input = {
  providerModelId: string;
  currency?: "EUR" | "USD";
  inputPricePerMillionTokens?: number;
  outputPricePerMillionTokens?: number;
  cachedInputPricePerMillionTokens?: number | null;
  cacheWritePricePerMillionTokens?: number | null;
  longContextPricePerMillionTokens?: number | null;
  searchToolPricePerRequest?: number | null;
  requestPrice?: number | null;
  imagePrice?: number | null;
  audioPrice?: number | null;
  batchDiscount?: number | null;
  retryCostMultiplier?: number | null;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  promotionName?: string | null;
  promotionActive?: boolean;
  promotionEndDate?: string | null;
  pricingStatus?: "DRAFT" | "VERIFIED" | "EXPIRED";
  platformMarkupPercent?: number;
  sourceUrl?: string | null;
  notes?: string | null;
  verifiedBy?: string | null;
};

export async function upsertPricingRecordV2(input: PricingRecordV2Input) {
  const status = input.pricingStatus ?? "DRAFT";
  return prisma.modelPricingRecord.create({
    data: {
      providerModelId: input.providerModelId,
      currency: input.currency ?? "EUR",
      inputPricePerMillionTokens: input.inputPricePerMillionTokens ?? 0,
      outputPricePerMillionTokens: input.outputPricePerMillionTokens ?? 0,
      cachedInputPricePerMillionTokens: input.cachedInputPricePerMillionTokens ?? null,
      cacheWritePricePerMillionTokens: input.cacheWritePricePerMillionTokens ?? null,
      longContextPricePerMillionTokens: input.longContextPricePerMillionTokens ?? null,
      searchToolPricePerRequest: input.searchToolPricePerRequest ?? null,
      requestPrice: input.requestPrice ?? null,
      imagePrice: input.imagePrice ?? null,
      audioPrice: input.audioPrice ?? null,
      batchDiscount: input.batchDiscount ?? null,
      retryCostMultiplier: input.retryCostMultiplier ?? 1,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null,
      promotionName: input.promotionName ?? null,
      promotionActive: input.promotionActive ?? false,
      promotionEndDate: input.promotionEndDate ? new Date(input.promotionEndDate) : null,
      pricingStatus: status,
      platformMarkupPercent: input.platformMarkupPercent ?? 30,
      sourceUrl: input.sourceUrl ?? null,
      notes: input.notes ?? null,
      verifiedAt: status === "VERIFIED" ? new Date() : null,
      verifiedBy: status === "VERIFIED" ? input.verifiedBy : null,
    },
    include: { providerModel: { include: { provider: true } } },
  });
}
