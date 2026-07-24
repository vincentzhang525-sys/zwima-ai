import {
  bootstrapUnifiedAdapters,
  listUnifiedAdapters,
} from "@/core/adapters";
import { clearAllCoreCaches, modelCache } from "@/core/cache";
import { loadPricingQuotes, refreshPricingCache } from "@/core/cost";
import {
  clearHealthEngineState,
  getCachedHealthMetrics,
  runHealthChecks,
  startHealthAutoRefresh,
  stopHealthAutoRefresh,
} from "@/core/health";
import {
  bootstrapDefaultProviders,
  listAllModels,
  listProviderRegistryEntries,
} from "@/core/providers";
import { routingEngine, RoutingError } from "@/core/router";
import type { RoutingRequest } from "@/core/router";
import type { AdapterChatRequest } from "@/core/adapters/types";
import type { ProviderId } from "@/core/providers/types";

let bootstrapped = false;

export function ensureCoreGateway(): void {
  if (bootstrapped) return;
  bootstrapDefaultProviders();
  bootstrapUnifiedAdapters();
  startHealthAutoRefresh();
  bootstrapped = true;
}

export function resetCoreGateway(): void {
  stopHealthAutoRefresh();
  clearHealthEngineState();
  clearAllCoreCaches();
  bootstrapped = false;
}

export type GatewayChatBody = {
  model?: string;
  provider?: ProviderId;
  messages: AdapterChatRequest["messages"];
  maxTokens?: number;
  temperature?: number;
  region?: RoutingRequest["region"];
  requireEuCompliance?: boolean;
  organizationId?: string;
  monthlyBudgetUsd?: number | null;
};

export type GatewayEmbeddingsBody = {
  model?: string;
  provider?: ProviderId;
  input: string | string[];
  region?: RoutingRequest["region"];
  requireEuCompliance?: boolean;
  organizationId?: string;
};

export async function gatewayChat(body: GatewayChatBody, requestId: string) {
  ensureCoreGateway();
  const routing: RoutingRequest = {
    model: body.model,
    provider: body.provider,
    capability: "chat",
    region: body.region,
    requireEuCompliance: body.requireEuCompliance,
    organizationId: body.organizationId,
    monthlyBudgetUsd: body.monthlyBudgetUsd,
  };

  return routingEngine.chat(
    routing,
    {
      messages: body.messages,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
    },
    requestId,
  );
}

export async function gatewayEmbeddings(body: GatewayEmbeddingsBody, requestId: string) {
  ensureCoreGateway();
  const routing: RoutingRequest = {
    model: body.model,
    provider: body.provider,
    capability: "embeddings",
    region: body.region,
    requireEuCompliance: body.requireEuCompliance,
    organizationId: body.organizationId,
  };

  return routingEngine.embeddings(routing, { input: body.input }, requestId);
}

export async function* gatewayStream(body: GatewayChatBody, requestId: string) {
  ensureCoreGateway();
  const routing: RoutingRequest = {
    model: body.model,
    provider: body.provider,
    capability: "stream",
    streaming: true,
    region: body.region,
    requireEuCompliance: body.requireEuCompliance,
    organizationId: body.organizationId,
    monthlyBudgetUsd: body.monthlyBudgetUsd,
  };

  yield* routingEngine.stream(
    routing,
    {
      messages: body.messages,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
    },
    requestId,
  );
}

export function gatewayModels() {
  ensureCoreGateway();
  const cached = modelCache.get("all");
  if (cached) return cached;

  const models = listAllModels();
  modelCache.set("all", models);
  return models;
}

export async function gatewayProviders() {
  ensureCoreGateway();
  const entries = await listProviderRegistryEntries();
  const adapters = listUnifiedAdapters();
  const health = getCachedHealthMetrics() ?? [];

  return entries.map((entry) => {
    const adapter = adapters.find((a) => a.id === entry.id);
    const metrics = health.find((h) => h.provider === entry.id);
    return {
      ...entry,
      adapterRegistered: Boolean(adapter),
      metrics: metrics ?? null,
    };
  });
}

export function gatewayPricing() {
  ensureCoreGateway();
  return loadPricingQuotes();
}

export function refreshGatewayPricing() {
  ensureCoreGateway();
  return refreshPricingCache();
}

export async function gatewayHealth(force = false) {
  ensureCoreGateway();
  if (force) return runHealthChecks();
  return getCachedHealthMetrics() ?? runHealthChecks();
}

export function gatewayRoutingPreview(request: RoutingRequest, requestId: string) {
  ensureCoreGateway();
  return routingEngine.route(request, requestId);
}

export { RoutingError };
