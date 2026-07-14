import type { Prisma } from "@prisma/client";
import { countMessageTokens } from "../billing/pricing-engine";
import { resolveRoutingPolicy } from "./policy-config";
import type { AnalyzeRequestInput, RequestCapability, RoutingRequestContext } from "./routing-types";

export function detectCapability(input: {
  capability?: RequestCapability;
  requestedModel?: string;
  metadata?: Record<string, unknown>;
}): RequestCapability {
  if (input.capability) return input.capability;
  const meta = input.metadata?.capability;
  if (typeof meta === "string") {
    const c = meta as RequestCapability;
    if (["chat", "embedding", "image", "audio", "video"].includes(c)) return c;
  }
  const model = (input.requestedModel ?? "").toLowerCase();
  if (model.includes("embed")) return "embedding";
  if (model.includes("dall") || model.includes("image")) return "image";
  if (model.includes("whisper") || model.includes("audio")) return "audio";
  if (model.includes("video")) return "video";
  return "chat";
}

export function detectStreamingRequired(input: {
  streamingRequired?: boolean;
  metadata?: Record<string, unknown>;
}): boolean {
  if (input.streamingRequired !== undefined) return input.streamingRequired;
  return Boolean(input.metadata?.stream ?? input.metadata?.streaming);
}

export function estimateTokens(input: AnalyzeRequestInput): { input: number; output: number } {
  const output = input.estimatedOutputTokens ?? 1024;
  if (input.estimatedInputTokens != null) {
    return { input: input.estimatedInputTokens, output };
  }
  if (input.messages?.length) {
    return { input: countMessageTokens(input.messages), output };
  }
  return { input: 500, output };
}

export async function analyzeRequest(input: AnalyzeRequestInput): Promise<RoutingRequestContext> {
  const capability = detectCapability(input);
  const streamingRequired = detectStreamingRequired(input);
  const tokens = estimateTokens(input);

  const { policy, sources, validationErrors } = await resolveRoutingPolicy({
    apiKeyMetadata: input.apiKeyMetadata as Prisma.JsonValue | null | undefined,
    organizationId: input.organizationId,
    routingPolicyId: input.routingPolicyId,
  });

  if (validationErrors.length > 0) {
    input.metadata = { ...input.metadata, policyValidationErrors: validationErrors };
  }

  const euOnly = input.euOnly ?? policy.euOnly ?? policy.requireDataResidency;
  const optimizationMode = input.optimizationMode ?? policy.optimizationMode;

  return {
    requestId: input.requestId,
    organizationId: input.organizationId,
    projectId: input.projectId ?? input.organizationId,
    apiKeyId: input.apiKeyId,
    requestedModel: input.requestedModel.trim(),
    preferredProvider: input.preferredProvider ?? null,
    capability,
    region: input.region ?? null,
    userCountry: input.userCountry ?? null,
    euOnly,
    estimatedInputTokens: tokens.input,
    estimatedOutputTokens: tokens.output,
    expectedLatencyTier: input.expectedLatencyTier ?? "STANDARD",
    optimizationMode,
    streamingRequired: streamingRequired || policy.requireStreaming,
    fallbackAllowed: input.fallbackAllowed ?? policy.allowFallback,
    excludedProviders: [...(input.excludedProviders ?? []), ...policy.blockedProviders],
    preferredProviders: input.preferredProviders ?? [],
    metadata: input.metadata ?? {},
    policy: {
      ...policy,
      optimizationMode,
      euOnly,
      requireStreaming: streamingRequired || policy.requireStreaming,
    },
    policySources: sources,
  };
}
