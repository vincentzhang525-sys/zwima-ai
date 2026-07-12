import { hashApiKey } from "./credits";
import { chargeForUsage, estimateRequestCredits } from "./billing/credits-engine";
import { prisma } from "./prisma";
import { routeByModel, recordProviderSuccess, recordProviderError } from "./providers/router";
import type { ChatMessage, ChatResult } from "./providers/types";

export type ChatExecutionResult = ChatResult & { costCredits: number; usageLogId: string };

export async function executeChatRequest(params: {
  apiKeyRaw: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatExecutionResult> {
  if (!params.apiKeyRaw.startsWith("sk_live_")) {
    throw new ChatError("Invalid API key", 401);
  }

  const keyHash = hashApiKey(params.apiKeyRaw);
  const key = await prisma.apiKey.findFirst({
    where: { keyHash, enabled: true },
    include: { user: { include: { creditBalance: true } } },
  });

  if (!key) throw new ChatError("Unauthorized", 401);

  if (key.expiresAt && key.expiresAt < new Date()) {
    throw new ChatError("API key expired", 401);
  }
  if (key.usageLimit != null && key.usageCount >= key.usageLimit) {
    throw new ChatError("API key usage limit exceeded", 429);
  }

  const wallet = key.user.creditBalance;
  const available = (wallet?.credits ?? 0) - (wallet?.frozenCredits ?? 0);

  const routed = await routeByModel(params.model);
  if (!routed) throw new ChatError("Model not found", 404);

  const providerRow = await prisma.provider.findUnique({ where: { slug: routed.adapter.slug } });
  if (!providerRow?.enabled) throw new ChatError("Provider unavailable", 503);

  const estimate = await estimateRequestCredits(
    params.messages,
    routed.adapter.slug,
    routed.model,
    params.maxTokens ?? 1024,
    { userId: key.userId, userTier: key.user.tier, providerSlug: routed.adapter.slug, modelId: routed.model }
  );

  if (available < estimate.customerCredits) {
    throw new ChatError("Insufficient credits", 402);
  }

  let result: ChatResult;
  try {
    result = await routed.adapter.chat({
      model: routed.model,
      messages: params.messages,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    });
    recordProviderSuccess(routed.adapter.slug, result.latencyMs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider request failed";
    recordProviderError(routed.adapter.slug, msg);
    throw new ChatError(msg, 502);
  }

  const { costCredits, usageLogId } = await chargeForUsage({
    userId: key.userId,
    apiKeyId: key.id,
    providerId: providerRow.id,
    providerSlug: routed.adapter.slug,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    userTier: key.user.tier,
  });

  return { ...result, costCredits, usageLogId };
}

export class ChatError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
