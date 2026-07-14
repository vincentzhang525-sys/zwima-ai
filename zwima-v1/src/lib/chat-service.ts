import { hashApiKey } from "./credits";
import { chargeForUsage } from "./billing/credits-engine";
import { countMessageTokens } from "./billing/pricing-engine";
import { prisma } from "./prisma";
import { routeByModel } from "./providers/router";
import type { ChatMessage, ChatResult } from "./providers/types";
import { generateRequestId } from "./request-id";
import { ApiError } from "./api-errors";
import { getPlatformEnv } from "./env";
import { routeRequest } from "./routing/policy-engine";
import { executeWithFallback } from "./routing/fallback-engine";
import { routeSmartRequest } from "./routing/smart-router";
import { executeSmartFailover } from "./routing/failover-engine";
import { buildRoutingResponseHeaders } from "./routing/routing-decision";
import { RoutingNoEligibleError } from "./routing/routing-errors";
import { estimateCost } from "./pricing/pricing-service";
import { checkMarginProtection, clampOutputTokens, MarginGuardError } from "./cost/margin-guard";
import {
  resolveApiKey,
  validateApiKeyState,
  checkProviderAllowed,
  checkModelAllowed,
  checkPermission,
  checkRateLimit,
  checkTpmLimit,
  checkIpWhitelist,
  checkBudget,
  touchApiKey,
  type ResolvedApiKey,
} from "./api-keys/governance";
import { writeAiAudit, updateAiAudit } from "./audit/ai-audit";

export type ChatExecutionResult = ChatResult & {
  costCredits: number;
  usageLogId: string;
  requestId: string;
  providerModelId?: string;
  routingReason?: string;
  fallbackCount?: number;
  routingHeaders?: Record<string, string>;
};

export class ChatError extends ApiError {
  constructor(code: ApiError["code"], message: string, status: number, requestId?: string) {
    super(code, message, status, requestId);
  }
}

type ChatRequestParams = {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  strategy?: string;
  clientRequestId?: string;
  requestId?: string;
  clientIp?: string | null;
  stream?: boolean;
  provider?: string;
};

export async function executeChatRequest(params: ChatRequestParams & { apiKeyRaw: string }): Promise<ChatExecutionResult> {
  const requestId = params.requestId ?? generateRequestId();

  if (!params.apiKeyRaw.startsWith("sk_live_")) {
    throw new ChatError("INVALID_API_KEY", "Invalid API key format.", 401, requestId);
  }

  const keyHash = hashApiKey(params.apiKeyRaw);
  const key = await resolveApiKey(keyHash);
  if (!key) throw new ChatError("INVALID_API_KEY", "Invalid API key.", 401, requestId);

  return runChatWithResolvedKey(key, params, requestId);
}

export async function executeChatRequestByKeyId(
  params: ChatRequestParams & { apiKeyId: string; organizationId: string; userId: string }
): Promise<ChatExecutionResult> {
  const requestId = params.requestId ?? generateRequestId();
  const key = await prisma.apiKey.findFirst({
    where: { id: params.apiKeyId, organizationId: params.organizationId, userId: params.userId },
    include: {
      user: { include: { creditBalance: true } },
      organization: true,
    },
  });
  if (!key) throw new ChatError("INVALID_API_KEY", "Invalid API key.", 401, requestId);
  return runChatWithResolvedKey(key as ResolvedApiKey, params, requestId);
}

async function runChatWithResolvedKey(
  key: ResolvedApiKey,
  params: ChatRequestParams,
  requestId: string
): Promise<ChatExecutionResult> {
  const env = getPlatformEnv();

  validateApiKeyState(key, requestId);
  checkPermission(key, "CHAT", requestId);
  checkRateLimit(key, requestId);

  const maxTokens = clampOutputTokens(params.maxTokens);
  const inputTokens = countMessageTokens(params.messages);
  checkIpWhitelist(key, params.clientIp ?? null, requestId);
  checkTpmLimit(key, inputTokens + maxTokens, requestId);
  const marginCtx = { userId: key.userId, userTier: key.user.tier as "STANDARD" | "VIP" | "ENTERPRISE" };

  if (params.clientRequestId) {
    const existing = await prisma.idempotencyRecord.findUnique({
      where: { clientRequestId_apiKeyId: { clientRequestId: params.clientRequestId, apiKeyId: key.id } },
    });
    if (existing) {
      throw new ChatError("VALIDATION_ERROR", "Duplicate clientRequestId.", 409, requestId);
    }
  }

  let providerSlug: string;
  let modelCode: string;
  let routingReason: string | undefined;
  let fallbackCount = 0;
  let attemptedProviders: string[] = [];
  let estimatedCharge = 0;

  if (env.routingEngine === "legacy") {
    const routed = await routeByModel(params.model);
    if (!routed) throw new ChatError("MODEL_NOT_FOUND", "Model not found.", 404, requestId);
    providerSlug = routed.adapter.slug;
    modelCode = routed.model;
    checkProviderAllowed(key, providerSlug, requestId);
    checkModelAllowed(key, modelCode, requestId);

    const providerRow = await prisma.provider.findUnique({ where: { slug: providerSlug } });
    if (!providerRow?.enabled) throw new ChatError("PROVIDER_UNAVAILABLE", "Provider unavailable.", 503, requestId);

    const estimate = await estimateCost({
      providerSlug,
      modelCode,
      inputTokens,
      outputTokens: maxTokens,
      marginCtx,
    });
    estimatedCharge = estimate.customerChargeCredits;
    await checkBudget(key, estimatedCharge, requestId);

    const wallet = key.user.creditBalance;
    const available = (wallet?.credits ?? 0) - (wallet?.frozenCredits ?? 0);
    if (available < estimatedCharge) {
      throw new ChatError("INSUFFICIENT_CREDITS", "Insufficient credits.", 402, requestId);
    }

    await writeAiAudit({
      requestId,
      organizationId: key.organizationId,
      userId: key.userId,
      apiKeyId: key.id,
      providerId: providerRow.id,
      promptText: params.messages.map((m) => m.content).join("\n"),
      inputTokens,
      outputTokens: maxTokens,
      estimatedProviderCost: estimate.providerCostEur,
      customerCharge: estimatedCharge,
      status: "PENDING",
      selectedProvider: providerSlug,
      selectedModel: modelCode,
    });

    let result: ChatResult;
    try {
      result = await routed.adapter.chat({ model: modelCode, messages: params.messages, maxTokens, temperature: params.temperature });
    } catch (err) {
      await updateAiAudit(requestId, { status: "FAILED", errorCode: "PROVIDER_ERROR" });
      throw new ChatError("PROVIDER_UNAVAILABLE", err instanceof Error ? err.message : "Provider request failed", 502, requestId);
    }

    const { costCredits, usageLogId } = await chargeForUsage({
      userId: key.userId,
      apiKeyId: key.id,
      providerId: providerRow.id,
      providerSlug,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      userTier: key.user.tier as "STANDARD" | "VIP" | "ENTERPRISE",
      requestId,
    });

    await touchApiKey(key.id, costCredits);
    await updateAiAudit(requestId, {
      status: "SUCCESS",
      actualProviderCost: estimate.providerCostEur,
      customerCharge: costCredits,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      completionText: result.content,
      latencyMs: result.latencyMs,
    });

    if (params.clientRequestId) {
      await prisma.idempotencyRecord.create({
        data: {
          clientRequestId: params.clientRequestId,
          apiKeyId: key.id,
          requestId,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
    }

    const providerModel = await prisma.providerModel.findUnique({
      where: { providerId_modelCode: { providerId: providerRow.id, modelCode } },
      select: { id: true },
    });

    return { ...result, costCredits, usageLogId, requestId, providerModelId: providerModel?.id };
  }

  if (env.routingEngine === "smart") {
    let smartDecision;
    try {
      smartDecision = await routeSmartRequest(
        {
          requestId,
          organizationId: key.organizationId,
          apiKeyId: key.id,
          apiKeyMetadata: key.metadata,
          requestedModel: params.model,
          preferredProvider: (params as { provider?: string }).provider ?? null,
          messages: params.messages,
          estimatedInputTokens: inputTokens,
          estimatedOutputTokens: maxTokens,
          optimizationMode: params.strategy as never,
          streamingRequired: Boolean((params as { stream?: boolean }).stream),
          excludedProviders: key.allowedProviders.length ? [] : [],
          preferredProviders: key.allowedProviders,
          metadata: { userTier: key.user.tier },
        },
        marginCtx,
      );
    } catch (err) {
      if (err instanceof RoutingNoEligibleError) {
        throw new ChatError("MODEL_NOT_FOUND", err.message, 503, requestId);
      }
      throw err;
    }

    providerSlug = smartDecision.selectedProviderSlug;
    modelCode = smartDecision.selectedModelId;
    routingReason = smartDecision.decisionReasons.join("; ");
    estimatedCharge = smartDecision.estimatedCustomerChargeCredits;

    checkProviderAllowed(key, providerSlug, requestId);
    checkModelAllowed(key, modelCode, requestId);

    const estimate = await estimateCost({ providerSlug, modelCode, inputTokens, outputTokens: maxTokens, marginCtx });
    try {
      await checkMarginProtection(estimate);
    } catch (err) {
      if (err instanceof MarginGuardError) {
        throw new ChatError("MARGIN_PROTECTION", err.message, 402, requestId);
      }
      throw err;
    }

    await checkBudget(key, estimatedCharge, requestId);
    const wallet = key.user.creditBalance;
    const available = (wallet?.credits ?? 0) - (wallet?.frozenCredits ?? 0);
    if (available < estimatedCharge) {
      throw new ChatError("INSUFFICIENT_CREDITS", "Insufficient credits.", 402, requestId);
    }

    const providerRow = await prisma.provider.findUnique({ where: { slug: providerSlug } });
    if (!providerRow?.enabled) throw new ChatError("PROVIDER_UNAVAILABLE", "Provider unavailable.", 503, requestId);

    await writeAiAudit({
      requestId,
      organizationId: key.organizationId,
      userId: key.userId,
      apiKeyId: key.id,
      providerId: providerRow.id,
      providerModelId: smartDecision.selectedProviderModelId,
      promptText: params.messages.map((m) => m.content).join("\n"),
      inputTokens,
      outputTokens: maxTokens,
      estimatedProviderCost: estimate.providerCostEur,
      customerCharge: estimatedCharge,
      status: "PENDING",
      selectedProvider: providerSlug,
      selectedModel: modelCode,
      strategy: smartDecision.optimizationMode,
      routingReason,
    });

    let execResult: ChatResult;
    try {
      const fb = await executeSmartFailover({
        decision: smartDecision,
        messages: params.messages,
        maxTokens,
        temperature: params.temperature,
        organizationId: key.organizationId,
        apiKeyId: key.id,
        userId: key.userId,
      });
      execResult = fb.result;
      fallbackCount = fb.fallbackCount;
      attemptedProviders = fb.attemptedProviders;
      routingReason = fb.decision.decisionReasons.join("; ");
      providerSlug = fb.decision.selectedProviderSlug;
      modelCode = fb.decision.selectedModelId;
      smartDecision = fb.decision;
    } catch (err) {
      await updateAiAudit(requestId, { status: "FAILED", errorCode: "PROVIDER_ERROR", fallbackCount, attemptedProviders });
      throw new ChatError("PROVIDER_UNAVAILABLE", err instanceof Error ? err.message : "All providers failed", 502, requestId);
    }

    const finalProvider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
    const { costCredits, usageLogId } = await chargeForUsage({
      userId: key.userId,
      apiKeyId: key.id,
      providerId: finalProvider!.id,
      providerSlug,
      model: execResult.model,
      inputTokens: execResult.inputTokens,
      outputTokens: execResult.outputTokens,
      latencyMs: execResult.latencyMs,
      userTier: key.user.tier as "STANDARD" | "VIP" | "ENTERPRISE",
      requestId,
    });

    await touchApiKey(key.id, costCredits);
    await updateAiAudit(requestId, {
      status: fallbackCount > 0 ? "FALLBACK" : "SUCCESS",
      actualProviderCost: estimate.providerCostEur,
      customerCharge: costCredits,
      margin: costCredits / 1000 - estimate.providerCostEur,
      inputTokens: execResult.inputTokens,
      outputTokens: execResult.outputTokens,
      completionText: execResult.content,
      latencyMs: execResult.latencyMs,
      fallbackCount,
      attemptedProviders,
    });

    if (params.clientRequestId) {
      await prisma.idempotencyRecord.create({
        data: {
          clientRequestId: params.clientRequestId,
          apiKeyId: key.id,
          requestId,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
    }

    const routingHeaders = buildRoutingResponseHeaders(smartDecision);
    routingHeaders["x-zwima-fallback-count"] = String(fallbackCount);

    return {
      ...execResult,
      costCredits,
      usageLogId,
      requestId,
      providerModelId: smartDecision.selectedProviderModelId,
      routingReason,
      fallbackCount,
      routingHeaders,
    };
  }

  // Policy routing engine
  const decision = await routeRequest(
    {
      organizationId: key.organizationId,
      apiKeyId: key.id,
      requestedModel: params.model,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: maxTokens,
      strategy: params.strategy as never,
      allowedProviders: key.allowedProviders,
      allowedModels: key.allowedModels,
    },
    marginCtx
  );

  providerSlug = decision.selected.providerSlug;
  modelCode = decision.selected.modelCode;
  routingReason = decision.routingReason;
  fallbackCount = decision.fallbackCount;
  attemptedProviders = decision.attemptedProviders;
  const policyId = decision.policyId;
  const strategy = decision.strategy;
  estimatedCharge = decision.estimatedCustomerCharge;

  checkProviderAllowed(key, providerSlug, requestId);
  checkModelAllowed(key, modelCode, requestId);

  const estimate = await estimateCost({ providerSlug, modelCode, inputTokens, outputTokens: maxTokens, marginCtx });
  try {
    await checkMarginProtection(estimate);
  } catch (err) {
    if (err instanceof MarginGuardError) {
      throw new ChatError("MARGIN_PROTECTION", err.message, 402, requestId);
    }
    throw err;
  }

  await checkBudget(key, estimatedCharge, requestId);

  const wallet = key.user.creditBalance;
  const available = (wallet?.credits ?? 0) - (wallet?.frozenCredits ?? 0);
  if (available < estimatedCharge) {
    throw new ChatError("INSUFFICIENT_CREDITS", "Insufficient credits.", 402, requestId);
  }

  const providerRow = await prisma.provider.findUnique({ where: { slug: providerSlug } });
  if (!providerRow?.enabled) throw new ChatError("PROVIDER_UNAVAILABLE", "Provider unavailable.", 503, requestId);

  await writeAiAudit({
    requestId,
    organizationId: key.organizationId,
    userId: key.userId,
    apiKeyId: key.id,
    providerId: providerRow.id,
    providerModelId: decision.selected.providerModelId || undefined,
    routingPolicyId: policyId ?? undefined,
    promptText: params.messages.map((m) => m.content).join("\n"),
    inputTokens,
    outputTokens: maxTokens,
    estimatedProviderCost: estimate.providerCostEur,
    customerCharge: estimatedCharge,
    status: "PENDING",
    selectedProvider: providerSlug,
    selectedModel: modelCode,
    strategy,
    routingReason,
    attemptedProviders,
  });

  let execResult: ChatResult;
  try {
    const fb = await executeWithFallback({
      decision,
      candidates: decision.candidates,
      messages: params.messages,
      maxTokens,
      temperature: params.temperature,
    });
    execResult = fb.result;
    fallbackCount = fb.decision.fallbackCount;
    attemptedProviders = fb.decision.attemptedProviders;
    routingReason = fb.decision.routingReason;
    providerSlug = fb.decision.selected.providerSlug;
    modelCode = fb.decision.selected.modelCode;
  } catch (err) {
    await updateAiAudit(requestId, { status: "FAILED", errorCode: "PROVIDER_ERROR", fallbackCount, attemptedProviders });
    throw new ChatError("PROVIDER_UNAVAILABLE", err instanceof Error ? err.message : "All providers failed", 502, requestId);
  }

  const finalProvider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
  const { costCredits, usageLogId } = await chargeForUsage({
    userId: key.userId,
    apiKeyId: key.id,
    providerId: finalProvider!.id,
    providerSlug,
    model: execResult.model,
    inputTokens: execResult.inputTokens,
    outputTokens: execResult.outputTokens,
    latencyMs: execResult.latencyMs,
    userTier: key.user.tier as "STANDARD" | "VIP" | "ENTERPRISE",
    requestId,
  });

  await touchApiKey(key.id, costCredits);
  await updateAiAudit(requestId, {
    status: fallbackCount > 0 ? "FALLBACK" : "SUCCESS",
    actualProviderCost: estimate.providerCostEur,
    customerCharge: costCredits,
    margin: costCredits / 1000 - estimate.providerCostEur,
    inputTokens: execResult.inputTokens,
    outputTokens: execResult.outputTokens,
    completionText: execResult.content,
    latencyMs: execResult.latencyMs,
    fallbackCount,
    attemptedProviders,
  });

  if (params.clientRequestId) {
    await prisma.idempotencyRecord.create({
      data: {
        clientRequestId: params.clientRequestId,
        apiKeyId: key.id,
        requestId,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
  }

  const finalProviderModel = await prisma.providerModel.findUnique({
    where: {
      providerId_modelCode: { providerId: finalProvider!.id, modelCode },
    },
    select: { id: true },
  });

  return {
    ...execResult,
    costCredits,
    usageLogId,
    requestId,
    providerModelId: finalProviderModel?.id ?? decision.selected.providerModelId ?? undefined,
    routingReason,
    fallbackCount,
  };
}
