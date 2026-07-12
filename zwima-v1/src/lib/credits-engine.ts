import { prisma } from "./prisma";
import {
  estimateCredits,
  estimateCreditsForRequest,
  countMessageTokens,
  getMarginMultiplier,
  getModelPricing,
} from "./providers/pricing";
import type { CostEstimate } from "./providers/types";

export type { CostEstimate };

/** Estimate cost before sending a request. */
export function estimateRequestCost(
  messages: { content: string }[],
  model: string,
  maxOutputTokens = 1024
): CostEstimate {
  const inputTokens = countMessageTokens(messages);
  const baseCredits = estimateCredits(inputTokens, maxOutputTokens, model);
  const pricing = getModelPricing(model);
  const rawBase =
    (inputTokens / 1000) * pricing.inputPer1k + (maxOutputTokens / 1000) * pricing.outputPer1k;
  const margin = getMarginMultiplier();
  return {
    inputTokens,
    outputTokens: maxOutputTokens,
    baseCredits: Math.max(1, Math.ceil(rawBase)),
    marginCredits: Math.max(1, Math.ceil(rawBase * margin)) - Math.max(1, Math.ceil(rawBase)),
    totalCredits: baseCredits,
  };
}

/** Deduct credits and store transaction + usage log atomically. */
export async function chargeForUsage(params: {
  userId: string;
  apiKeyId: string;
  providerId: string;
  providerSlug: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}) {
  const costCredits = estimateCredits(params.inputTokens, params.outputTokens, params.model);

  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { userId: params.userId } });
    if (!balance || balance.credits < costCredits) {
      throw new Error("Insufficient credits");
    }

    await tx.creditBalance.update({
      where: { userId: params.userId },
      data: { credits: { decrement: costCredits } },
    });

    const usageLog = await tx.usageLog.create({
      data: {
        userId: params.userId,
        apiKeyId: params.apiKeyId,
        providerId: params.providerId,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        costCredits,
        latencyMs: params.latencyMs,
      },
    });

    await tx.transaction.create({
      data: {
        userId: params.userId,
        type: "DEBIT",
        amount: costCredits,
        description: `${params.providerSlug}/${params.model}`,
      },
    });

    await tx.apiKey.update({
      where: { id: params.apiKeyId },
      data: { lastUsed: new Date() },
    });

    return { costCredits, usageLogId: usageLog.id };
  });
}

export { estimateCreditsForRequest, estimateCredits, countMessageTokens };
