import type {
  OptimizationMode,
  ProviderCandidate,
  RoutingCandidate,
  RoutingWeights,
  SmartScoreBreakdown,
} from "./routing-types";
import type { RoutingStrategy } from "@prisma/client";

const QUALITY_SCORE: Record<string, number> = {
  ECONOMY: 0.4,
  STANDARD: 0.6,
  PREMIUM: 0.8,
  FLAGSHIP: 1.0,
};

const HEALTH_SCORE: Record<string, number> = {
  HEALTHY: 1.0,
  DEGRADED: 0.6,
  DOWN: 0.0,
  UNKNOWN: 0.5,
};

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return Math.max(0, Math.min(1, 1 - (value - min) / (max - min)));
}

export function scoreCandidates(
  candidates: RoutingCandidate[],
  strategy: RoutingStrategy,
  weights: RoutingWeights,
  requiredRegion?: string | null
): RoutingCandidate[] {
  const eligible = candidates.filter((c) => !c.excluded);
  if (eligible.length === 0) return candidates;

  const costs = eligible.map((c) => c.estimatedProviderCostEur);
  const latencies = eligible.map((c) => c.latencyP50 ?? 500);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minLat = Math.min(...latencies);
  const maxLat = Math.max(...latencies);

  for (const c of eligible) {
    const costScore = normalize(c.estimatedProviderCostEur, minCost, maxCost);
    const latencyScore = normalize(c.latencyP50 ?? 500, minLat, maxLat);
    const qualityScore = QUALITY_SCORE[c.qualityTier] ?? 0.6;
    const reliabilityScore = HEALTH_SCORE[c.healthStatus] ?? 0.5;
    const regionScore =
      requiredRegion && c.region
        ? c.region.toUpperCase() === requiredRegion.toUpperCase()
          ? 1
          : c.dataResidency?.toUpperCase() === "EU"
            ? 0.7
            : 0.3
        : 0.5;

    let total: number;
    switch (strategy) {
      case "LOWEST_COST":
        total = costScore;
        break;
      case "LOWEST_LATENCY":
        total = latencyScore;
        break;
      case "HIGHEST_QUALITY":
        total = qualityScore;
        break;
      case "EU_PREFERRED":
        total = regionScore * 0.6 + costScore * 0.4;
        break;
      case "PROVIDER_PRIORITY":
        total = reliabilityScore;
        break;
      case "MODEL_PINNED":
        total = 1;
        break;
      case "BUDGET_MODE":
        total = costScore * 0.8 + reliabilityScore * 0.2;
        break;
      case "PREMIUM_MODE":
        total = qualityScore * 0.7 + reliabilityScore * 0.3;
        break;
      default:
        total =
          costScore * weights.costWeight +
          latencyScore * weights.latencyWeight +
          qualityScore * weights.qualityWeight +
          reliabilityScore * weights.reliabilityWeight +
          regionScore * weights.regionWeight;
    }

    c.scores = { cost: costScore, latency: latencyScore, quality: qualityScore, reliability: reliabilityScore, region: regionScore, total };
  }

  eligible.sort((a, b) => (b.scores?.total ?? 0) - (a.scores?.total ?? 0));
  return candidates;
}

export function selectTopCandidate(candidates: RoutingCandidate[]): RoutingCandidate | null {
  const eligible = candidates.filter((c) => !c.excluded);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => (b.scores?.total ?? 0) - (a.scores?.total ?? 0));
  return eligible[0] ?? null;
}

// ─── Smart Routing V1 (0–100 scores) ─────────────────────────────────────────

const MODE_WEIGHTS: Record<
  OptimizationMode,
  { cost: number; latency: number; reliability: number; quality: number; compliance: number; priority: number }
> = {
  BALANCED: { cost: 0.25, latency: 0.2, reliability: 0.2, quality: 0.15, compliance: 0.15, priority: 0.05 },
  LOWEST_COST: { cost: 0.6, latency: 0.1, reliability: 0.15, quality: 0.05, compliance: 0.1, priority: 0 },
  LOWEST_LATENCY: { cost: 0.1, latency: 0.6, reliability: 0.2, quality: 0.05, compliance: 0.05, priority: 0 },
  HIGHEST_QUALITY: { cost: 0.05, latency: 0.1, reliability: 0.2, quality: 0.5, compliance: 0.15, priority: 0 },
  EU_COMPLIANCE: { cost: 0.05, latency: 0.1, reliability: 0.2, quality: 0.1, compliance: 0.55, priority: 0 },
};

function norm100(value: number, min: number, max: number, invert = false): number {
  if (max === min) return 50;
  const n = (value - min) / (max - min);
  const v = invert ? 1 - n : n;
  return Math.round(Math.max(0, Math.min(100, v * 100)) * 100) / 100;
}

export function scoreSmartCandidates(
  candidates: ProviderCandidate[],
  mode: OptimizationMode,
  opts?: { preferredProviders?: string[]; preferredProvider?: string | null },
): ProviderCandidate[] {
  const eligible = candidates.filter((c) => !c.excluded);
  if (eligible.length === 0) return candidates;

  const costs = eligible.map((c) => c.estimatedRequestCostEur);
  const lats = eligible.map((c) => c.latencyP50 ?? 800);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const weights = MODE_WEIGHTS[mode];

  for (const c of eligible) {
    const costScore = norm100(c.estimatedRequestCostEur, minCost, maxCost, true);
    const latencyScore = norm100(c.latencyP50 ?? 800, minLat, maxLat, true);
    const reliabilityScore = Math.min(100, Math.max(0, c.successRate));
    const qualityScore = c.qualityScore;
    const complianceScore = c.euCompliant ? 100 : 30;
    const priorityScore = Math.min(100, (c.routingPriority / 100) * 50 + (c.routingWeight / 200) * 50);
    const promotionScore =
      c.promotionActive && c.promotionEndDate && new Date(c.promotionEndDate) > new Date() ? 100 : 0;

    let boost = 0;
    if (opts?.preferredProvider === c.providerSlug) boost += 5;
    if (opts?.preferredProviders?.includes(c.providerSlug)) boost += 3;

    const totalScore =
      costScore * weights.cost +
      latencyScore * weights.latency +
      reliabilityScore * weights.reliability +
      qualityScore * weights.quality +
      complianceScore * weights.compliance +
      priorityScore * weights.priority +
      promotionScore * 0.02 +
      boost;

    const breakdown: SmartScoreBreakdown = {
      costScore,
      latencyScore,
      reliabilityScore,
      qualityScore,
      complianceScore,
      priorityScore,
      promotionScore,
      weights: weights as unknown as Record<string, number>,
      totalScore: Math.round(Math.min(100, totalScore) * 100) / 100,
    };
    c.scoreBreakdown = breakdown;
    c.totalScore = breakdown.totalScore;
  }

  eligible.sort((a, b) => b.totalScore - a.totalScore);
  return candidates;
}

export function selectTopSmartCandidate(candidates: ProviderCandidate[]): ProviderCandidate | null {
  const eligible = candidates.filter((c) => !c.excluded);
  if (!eligible.length) return null;
  eligible.sort((a, b) => b.totalScore - a.totalScore);
  return eligible[0] ?? null;
}

export function buildDecisionReasons(winner: ProviderCandidate, mode: OptimizationMode): string[] {
  const reasons: string[] = [];
  const b = winner.scoreBreakdown;
  if (!b) return [`Selected via ${mode}`];
  if (b.costScore >= 80) reasons.push("Lowest estimated cost among eligible providers");
  if (b.reliabilityScore >= 99) reasons.push("Provider success rate above 99%");
  if (winner.supportsStreaming) reasons.push("Streaming capability required and matched");
  if (winner.promotionActive && winner.promotionEndDate) {
    reasons.push(`Promotion price active until ${winner.promotionEndDate.slice(0, 10)}`);
  }
  if (b.latencyScore >= 75) reasons.push("Lower latency in preferred region");
  if (b.complianceScore >= 90) reasons.push("EU-compliant provider selected");
  if (reasons.length === 0) reasons.push(`Best composite score (${b.totalScore}) for ${mode} mode`);
  return reasons;
}

export { MODE_WEIGHTS };
