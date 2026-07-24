import { TtlCache } from "./ttl-cache";
import type { ProviderRegistryEntry, ModelRegistryEntry, ProviderHealthSnapshot } from "@/core/providers/types";
import type { ModelPricingQuote } from "@/core/cost/types";

const DEFAULT_PROVIDER_TTL = Number(process.env.CORE_CACHE_PROVIDER_TTL_MS ?? 60_000);
const DEFAULT_PRICING_TTL = Number(process.env.CORE_CACHE_PRICING_TTL_MS ?? 300_000);
const DEFAULT_HEALTH_TTL = Number(process.env.CORE_CACHE_HEALTH_TTL_MS ?? 30_000);
const DEFAULT_MODEL_TTL = Number(process.env.CORE_CACHE_MODEL_TTL_MS ?? 120_000);

export const providerCache = new TtlCache<ProviderRegistryEntry[]>(DEFAULT_PROVIDER_TTL);
export const pricingCache = new TtlCache<ModelPricingQuote[]>(DEFAULT_PRICING_TTL);
export const healthCache = new TtlCache<ProviderHealthSnapshot[]>(DEFAULT_HEALTH_TTL);
export const modelCache = new TtlCache<ModelRegistryEntry[]>(DEFAULT_MODEL_TTL);

export function clearAllCoreCaches(): void {
  providerCache.clear();
  pricingCache.clear();
  healthCache.clear();
  modelCache.clear();
}
