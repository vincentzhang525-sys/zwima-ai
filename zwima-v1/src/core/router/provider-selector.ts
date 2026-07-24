import { listUnifiedAdapters } from "@/core/adapters";
import { listModelsByProvider } from "@/core/providers/model-registry";
import type { ProviderId } from "@/core/providers/types";
import { modelSupportsCapability, resolveCapabilities } from "./capability-resolver";
import { getProviderHealthScore, isProviderHealthy } from "./health-monitor";
import { applyRegionPolicy } from "./region-policy";
import type { RoutingCandidate, RoutingRequest } from "./types";

export function buildRoutingCandidates(request: RoutingRequest): RoutingCandidate[] {
  const caps = resolveCapabilities(request);
  const adapters = listUnifiedAdapters();
  const candidates: RoutingCandidate[] = [];

  for (const adapter of adapters) {
    if (request.provider && adapter.id !== request.provider) continue;
    if (!isProviderHealthy(adapter.id)) continue;

    const models = listModelsByProvider(adapter.id);
    for (const model of models) {
      if (request.model && model.modelId !== request.model) continue;
      if (!caps.every((cap) => modelSupportsCapability(model, cap))) continue;

      const region = applyRegionPolicy(adapter.id, model.modelId, request);
      if (!region.allowed) continue;

      const healthScore = getProviderHealthScore(adapter.id);
      const costScore = Math.max(0, 20 - Math.floor((model.inputCostPer1M + model.outputCostPer1M) / 2));
      const priorityScore = requireProviderPriority(adapter.id);
      const score = healthScore + costScore + priorityScore + region.scoreBoost;

      candidates.push({
        provider: adapter.id,
        model: model.modelId,
        score,
        reasons: [
          `health=${healthScore}`,
          `cost=${costScore}`,
          `priority=${priorityScore}`,
          ...(region.scoreBoost ? [`eu_boost=${region.scoreBoost}`] : []),
        ],
        euCompliance: model.euCompliance,
        latencyMs: null,
        online: true,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function requireProviderPriority(provider: ProviderId): number {
  const priority: Record<ProviderId, number> = {
    gemini: 95,
    openai: 90,
    claude: 85,
    qwen: 75,
    deepseek: 70,
  };
  return priority[provider] ?? 0;
}

export function selectBestCandidate(candidates: RoutingCandidate[]): RoutingCandidate | null {
  return candidates[0] ?? null;
}
