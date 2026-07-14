import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { OptimizationMode, RoutingPolicyConfig } from "./routing-types";

export const DEFAULT_ROUTING_POLICY: RoutingPolicyConfig = {
  optimizationMode: "BALANCED",
  euOnly: false,
  allowedProviders: [],
  blockedProviders: [],
  allowedRegions: [],
  maxCostPerRequestEur: null,
  maxLatencyMs: null,
  minimumQualityScore: 0,
  allowFallback: true,
  maxFallbackAttempts: 2,
  preferCachedResponse: true,
  requireStreaming: false,
  requireDataResidency: false,
  requireTransparencyDisclosure: true,
};

export function validateRoutingPolicy(raw: unknown): {
  policy: RoutingPolicyConfig;
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { policy: { ...DEFAULT_ROUTING_POLICY }, valid: false, errors: ["Policy must be an object"] };
  }
  const o = raw as Record<string, unknown>;
  const modes: OptimizationMode[] = [
    "BALANCED",
    "LOWEST_COST",
    "LOWEST_LATENCY",
    "HIGHEST_QUALITY",
    "EU_COMPLIANCE",
  ];

  const optimizationMode = modes.includes(o.optimizationMode as OptimizationMode)
    ? (o.optimizationMode as OptimizationMode)
    : DEFAULT_ROUTING_POLICY.optimizationMode;
  if (o.optimizationMode && !modes.includes(o.optimizationMode as OptimizationMode)) {
    errors.push(`Invalid optimizationMode: ${String(o.optimizationMode)}`);
  }

  const policy: RoutingPolicyConfig = {
    optimizationMode,
    euOnly: typeof o.euOnly === "boolean" ? o.euOnly : DEFAULT_ROUTING_POLICY.euOnly,
    allowedProviders: stringArray(o.allowedProviders),
    blockedProviders: stringArray(o.blockedProviders),
    allowedRegions: stringArray(o.allowedRegions),
    maxCostPerRequestEur: nullableNumber(o.maxCostPerRequestEur),
    maxLatencyMs: nullableNumber(o.maxLatencyMs),
    minimumQualityScore: clampNumber(o.minimumQualityScore, 0, 100, 0),
    allowFallback: typeof o.allowFallback === "boolean" ? o.allowFallback : DEFAULT_ROUTING_POLICY.allowFallback,
    maxFallbackAttempts: clampNumber(o.maxFallbackAttempts, 0, 10, 2),
    preferCachedResponse:
      typeof o.preferCachedResponse === "boolean"
        ? o.preferCachedResponse
        : DEFAULT_ROUTING_POLICY.preferCachedResponse,
    requireStreaming:
      typeof o.requireStreaming === "boolean" ? o.requireStreaming : DEFAULT_ROUTING_POLICY.requireStreaming,
    requireDataResidency:
      typeof o.requireDataResidency === "boolean"
        ? o.requireDataResidency
        : DEFAULT_ROUTING_POLICY.requireDataResidency,
    requireTransparencyDisclosure:
      typeof o.requireTransparencyDisclosure === "boolean"
        ? o.requireTransparencyDisclosure
        : DEFAULT_ROUTING_POLICY.requireTransparencyDisclosure,
  };

  return { policy, valid: errors.length === 0, errors };
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
}

function nullableNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function mergeRoutingPolicies(
  ...layers: (Partial<RoutingPolicyConfig> | null | undefined)[]
): RoutingPolicyConfig {
  const merged = { ...DEFAULT_ROUTING_POLICY };
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.optimizationMode) merged.optimizationMode = layer.optimizationMode;
    if (layer.euOnly !== undefined) merged.euOnly = layer.euOnly;
    if (layer.allowedProviders?.length) merged.allowedProviders = layer.allowedProviders;
    if (layer.blockedProviders?.length) merged.blockedProviders = [...merged.blockedProviders, ...layer.blockedProviders];
    if (layer.allowedRegions?.length) merged.allowedRegions = layer.allowedRegions;
    if (layer.maxCostPerRequestEur !== undefined) merged.maxCostPerRequestEur = layer.maxCostPerRequestEur;
    if (layer.maxLatencyMs !== undefined) merged.maxLatencyMs = layer.maxLatencyMs;
    if (layer.minimumQualityScore !== undefined) merged.minimumQualityScore = layer.minimumQualityScore;
    if (layer.allowFallback !== undefined) merged.allowFallback = layer.allowFallback;
    if (layer.maxFallbackAttempts !== undefined) merged.maxFallbackAttempts = layer.maxFallbackAttempts;
    if (layer.preferCachedResponse !== undefined) merged.preferCachedResponse = layer.preferCachedResponse;
    if (layer.requireStreaming !== undefined) merged.requireStreaming = layer.requireStreaming;
    if (layer.requireDataResidency !== undefined) merged.requireDataResidency = layer.requireDataResidency;
    if (layer.requireTransparencyDisclosure !== undefined) {
      merged.requireTransparencyDisclosure = layer.requireTransparencyDisclosure;
    }
  }
  return merged;
}

function parseJsonPolicy(raw: Prisma.JsonValue | null | undefined): Partial<RoutingPolicyConfig> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const routing = (o.routingPolicy ?? o.routing ?? o) as Record<string, unknown>;
  const { policy } = validateRoutingPolicy(routing);
  return policy;
}

export async function resolveRoutingPolicy(params: {
  apiKeyMetadata?: Prisma.JsonValue | null;
  organizationId?: string | null;
  routingPolicyId?: string | null;
}): Promise<{ policy: RoutingPolicyConfig; sources: string[]; validationErrors: string[] }> {
  const sources: string[] = ["system_default"];
  const validationErrors: string[] = [];
  let systemPolicy: Partial<RoutingPolicyConfig> = {};
  let orgPolicy: Partial<RoutingPolicyConfig> | null = null;
  let apiKeyPolicy: Partial<RoutingPolicyConfig> | null = null;
  let dbPolicy: Partial<RoutingPolicyConfig> | null = null;

  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: "smart_routing_default" } });
    if (row?.value) {
      const parsed = validateRoutingPolicy(JSON.parse(row.value));
      if (parsed.valid) {
        systemPolicy = parsed.policy;
        sources.push("platform_config");
      } else {
        validationErrors.push(...parsed.errors);
      }
    }
  } catch {
    validationErrors.push("Invalid platform smart_routing_default JSON");
  }

  if (params.routingPolicyId || params.organizationId) {
    let policyRow = params.routingPolicyId
      ? await prisma.routingPolicy.findUnique({ where: { id: params.routingPolicyId } })
      : null;
    if (!policyRow && params.organizationId) {
      policyRow = await prisma.routingPolicy.findFirst({
        where: { organizationId: params.organizationId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      });
    }
    if (!policyRow) {
      policyRow = await prisma.routingPolicy.findFirst({
        where: { organizationId: null, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      });
    }
    if (policyRow) {
      dbPolicy = {
        optimizationMode: mapDbStrategy(policyRow.strategy),
        allowedProviders: policyRow.allowedProviders,
        blockedProviders: policyRow.blockedProviders,
        allowedRegions: policyRow.requiredRegion ? [policyRow.requiredRegion] : [],
        maxCostPerRequestEur: policyRow.maximumCostPerRequest ? Number(policyRow.maximumCostPerRequest) : null,
        maxLatencyMs: policyRow.maximumLatencyMs,
        allowFallback: policyRow.fallbackEnabled,
        maxFallbackAttempts: policyRow.maxRetries,
        euOnly: policyRow.requiredRegion?.toUpperCase() === "EU",
      };
      sources.push("routing_policy_db");
    }
  }

  if (params.organizationId) {
    orgPolicy = dbPolicy;
    if (orgPolicy) sources.push("organization");
  }

  apiKeyPolicy = parseJsonPolicy(params.apiKeyMetadata);
  if (apiKeyPolicy) sources.push("api_key_metadata");

  const merged = mergeRoutingPolicies(systemPolicy, dbPolicy, orgPolicy, apiKeyPolicy);
  const validated = validateRoutingPolicy(merged);
  if (!validated.valid) validationErrors.push(...validated.errors);

  return {
    policy: validated.policy,
    sources: [...new Set(sources)],
    validationErrors,
  };
}

function mapDbStrategy(strategy: string): OptimizationMode {
  const map: Record<string, OptimizationMode> = {
    BALANCED: "BALANCED",
    LOWEST_COST: "LOWEST_COST",
    LOWEST_LATENCY: "LOWEST_LATENCY",
    HIGHEST_QUALITY: "HIGHEST_QUALITY",
    EU_PREFERRED: "EU_COMPLIANCE",
    BUDGET_MODE: "LOWEST_COST",
    PREMIUM_MODE: "HIGHEST_QUALITY",
  };
  return map[strategy] ?? "BALANCED";
}

export function getTransparencyEnforcementDate(): Date {
  const raw = process.env.AI_TRANSPARENCY_ENFORCEMENT_DATE ?? "2026-08-02";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date("2026-08-02") : d;
}
