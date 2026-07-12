import { prisma } from "../prisma";
import { getEffectiveMultiplier, applyMargin, type MarginContext } from "./margin-engine";

export type PricingRow = {
  providerSlug: string;
  modelId: string;
  inputTokenCost: number;
  outputTokenCost: number;
  marginPercent: number;
  customerPriceIn: number;
  customerPriceOut: number;
};

function toNum(v: unknown): number {
  return Number(v);
}

export async function getModelPricing(providerSlug: string, modelId: string): Promise<PricingRow | null> {
  const row = await prisma.modelPricing.findUnique({
    where: { providerSlug_modelId: { providerSlug, modelId } },
  });
  if (!row) return null;
  return {
    providerSlug: row.providerSlug,
    modelId: row.modelId,
    inputTokenCost: toNum(row.inputTokenCost),
    outputTokenCost: toNum(row.outputTokenCost),
    marginPercent: toNum(row.marginPercent),
    customerPriceIn: toNum(row.customerPriceIn),
    customerPriceOut: toNum(row.customerPriceOut),
  };
}

export async function listAllPricing(): Promise<PricingRow[]> {
  const rows = await prisma.modelPricing.findMany({ orderBy: [{ providerSlug: "asc" }, { modelId: "asc" }] });
  return rows.map((row) => ({
    providerSlug: row.providerSlug,
    modelId: row.modelId,
    inputTokenCost: toNum(row.inputTokenCost),
    outputTokenCost: toNum(row.outputTokenCost),
    marginPercent: toNum(row.marginPercent),
    customerPriceIn: toNum(row.customerPriceIn),
    customerPriceOut: toNum(row.customerPriceOut),
  }));
}

export async function upsertModelPricing(data: {
  providerSlug: string;
  modelId: string;
  inputTokenCost: number;
  outputTokenCost: number;
  marginPercent?: number;
}) {
  const marginPct = data.marginPercent ?? 30;
  const multiplier = 1 + marginPct / 100;
  const customerPriceIn = data.inputTokenCost * multiplier;
  const customerPriceOut = data.outputTokenCost * multiplier;

  return prisma.modelPricing.upsert({
    where: { providerSlug_modelId: { providerSlug: data.providerSlug, modelId: data.modelId } },
    create: {
      providerSlug: data.providerSlug,
      modelId: data.modelId,
      inputTokenCost: data.inputTokenCost,
      outputTokenCost: data.outputTokenCost,
      marginPercent: marginPct,
      customerPriceIn,
      customerPriceOut,
    },
    update: {
      inputTokenCost: data.inputTokenCost,
      outputTokenCost: data.outputTokenCost,
      marginPercent: marginPct,
      customerPriceIn,
      customerPriceOut,
    },
  });
}

/** Calculate customer credits for token usage. */
export async function calculateUsageCredits(params: {
  providerSlug: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  marginCtx?: MarginContext;
}): Promise<{ providerCost: number; customerCredits: number; multiplier: number }> {
  const pricing = await getModelPricing(params.providerSlug, params.modelId);
  const inputRate = pricing?.inputTokenCost ?? 1;
  const outputRate = pricing?.outputTokenCost ?? 2;
  const customerIn = pricing?.customerPriceIn ?? inputRate * 1.3;
  const customerOut = pricing?.customerPriceOut ?? outputRate * 1.3;

  const providerCost =
    (params.inputTokens / 1000) * inputRate + (params.outputTokens / 1000) * outputRate;

  const multiplier = await getEffectiveMultiplier({
    providerSlug: params.providerSlug,
    modelId: params.modelId,
    ...params.marginCtx,
  });

  const baseCustomer =
    (params.inputTokens / 1000) * customerIn + (params.outputTokens / 1000) * customerOut;
  const withMargin = applyMargin(providerCost, multiplier);
  const customerCredits = Math.max(1, Math.ceil(Math.max(baseCustomer, withMargin)));

  return { providerCost, customerCredits, multiplier };
}

export function countMessageTokens(messages: { content: string }[]): number {
  return messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0);
}

export async function estimateRequestCredits(
  messages: { content: string }[],
  providerSlug: string,
  modelId: string,
  maxOutputTokens = 1024,
  marginCtx?: MarginContext
) {
  const inputTokens = countMessageTokens(messages);
  return calculateUsageCredits({
    providerSlug,
    modelId,
    inputTokens,
    outputTokens: maxOutputTokens,
    marginCtx,
  });
}
