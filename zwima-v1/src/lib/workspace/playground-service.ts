import { executeChatRequestByKeyId, ChatError } from "../chat-service";
import { generateRequestId } from "../request-id";
import { resolveWorkspaceApiKeyRecord } from "./api-keys-workspace";
import { parseApiKeyMetadata } from "./project-repository";
import type { ChatMessage } from "../providers/types";
import { creditsToEur } from "./http";

export async function runWorkspacePlayground(params: {
  userId: string;
  organizationId: string;
  apiKeyId: string;
  model: string;
  routingMode?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}) {
  const key = await resolveWorkspaceApiKeyRecord(params.apiKeyId, params.organizationId, params.userId);
  const meta = parseApiKeyMetadata(key.metadata);
  const strategy = params.routingMode ?? meta.routingMode ?? "BALANCED";

  const messages: ChatMessage[] = [];
  if (params.systemPrompt?.trim()) {
    messages.push({ role: "system", content: params.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: params.userPrompt });

  const requestId = generateRequestId();

  try {
    const result = await executeChatRequestByKeyId({
      apiKeyId: params.apiKeyId,
      organizationId: params.organizationId,
      userId: params.userId,
      model: params.model,
      messages,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      strategy,
      requestId,
      stream: params.stream,
    });

    return {
      requestId: result.requestId,
      content: result.content,
      selectedProvider: result.provider,
      selectedModel: result.model,
      routingMode: strategy,
      routingReason: result.routingReason ?? null,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostEur: creditsToEur(result.costCredits),
      creditsUsed: result.costCredits,
      compliance: result.routingHeaders
        ? {
            transparency: result.routingHeaders["x-zwima-transparency"] ?? null,
            euDataResidency: result.routingHeaders["x-zwima-data-residency"] ?? null,
          }
        : null,
      failoverOccurred: (result.fallbackCount ?? 0) > 0,
      failoverCount: result.fallbackCount ?? 0,
    };
  } catch (err) {
    if (err instanceof ChatError) {
      return {
        error: err.toJSON().error,
        requestId,
      };
    }
    throw err;
  }
}
