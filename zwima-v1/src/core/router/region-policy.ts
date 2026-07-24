import type { ProviderId } from "@/core/providers/types";
import { listEuCompliantModels } from "@/core/providers/model-registry";
import type { RoutingRequest } from "./types";

const EU_PREFERRED: ProviderId[] = ["gemini", "openai", "claude"];

export function applyRegionPolicy(
  provider: ProviderId,
  modelId: string,
  request: RoutingRequest,
): { allowed: boolean; reason: string | null; scoreBoost: number } {
  if (!request.requireEuCompliance && request.region !== "EU") {
    return { allowed: true, reason: null, scoreBoost: 0 };
  }

  const euModels = new Set(listEuCompliantModels().map((m) => m.modelId));
  if (request.requireEuCompliance || request.region === "EU") {
    if (!euModels.has(modelId)) {
      return { allowed: false, reason: "Model not EU compliant", scoreBoost: 0 };
    }
    const boost = EU_PREFERRED.indexOf(provider) >= 0 ? 15 - EU_PREFERRED.indexOf(provider) * 3 : 0;
    return { allowed: true, reason: null, scoreBoost: boost };
  }

  return { allowed: true, reason: null, scoreBoost: 0 };
}
