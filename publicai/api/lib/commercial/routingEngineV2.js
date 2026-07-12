const crypto = require("crypto");
const { getAdminClient } = require("../supabase");
const providerRegistry = require("./providerRegistry");
const modelRegistry = require("./modelRegistry");

const DEFAULT_WEIGHTS = {
  health: 0.3,
  cost: 0.25,
  latency: 0.2,
  region: 0.1,
  gdpr: 0.15,
  availability: 0.0,
  priority: 0.0,
};

async function loadRoutingPolicy(context = {}) {
  const admin = getAdminClient();
  const { organizationId, userId } = context;

  const { data: policies } = await admin
    .from("commercial_routing_policies")
    .select("*")
    .eq("status", "active")
    .order("priority");

  return (
    (policies || []).find((p) => p.organization_id === organizationId && p.policy_type === "enterprise") ||
    (policies || []).find((p) => p.user_id === userId && p.policy_type === "customer") ||
    (policies || []).find((p) => p.policy_type === "default") ||
    {
      weights: DEFAULT_WEIGHTS,
      require_eu: false,
      require_gdpr: false,
      fallback_chain: ["openai", "google", "anthropic", "deepseek"],
    }
  );
}

function normalizeHealthScore(provider) {
  if (provider.healthScore != null) return Math.min(100, Math.max(0, Number(provider.healthScore)));
  const map = { online: 100, degraded: 60, offline: 10, unknown: 50, not_configured: 0 };
  return map[provider.healthStatus] ?? 50;
}

function scoreProvider(provider, model, policy, context = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(policy.weights || {}) };
  const health = normalizeHealthScore(provider) / 100;
  const cost = 1 - Math.min(1, (Number(model?.inputPricePer1m || 0) + Number(model?.outputPricePer1m || 0)) / 20);
  const latency = 1 - Math.min(1, (Number(provider.avgLatencyMs || model?.avgLatencyMs || 500)) / 5000);
  const regionMatch =
    !context.region || context.region === "any" || provider.region === context.region || provider.region === "global"
      ? 1
      : 0;
  const gdpr = model?.gdprCompatible && model?.euAvailable ? 1 : policy.require_gdpr ? 0 : 0.5;
  const availability = model?.availability === "active" ? 1 : 0;
  const priority = 1 - Math.min(1, (Number(provider.priority || 100) - 1) / 99);

  const total =
    health * (weights.health || 0) +
    cost * (weights.cost || 0) +
    latency * (weights.latency || 0) +
    regionMatch * (weights.region || 0) +
    gdpr * (weights.gdpr || 0) +
    availability * (weights.availability || 0) +
    priority * (weights.priority || 0);

  return {
    providerId: provider.id,
    modelId: model.id,
    score: Number(total.toFixed(4)),
    breakdown: { health, cost, latency, regionMatch, gdpr, availability, priority },
  };
}

function filterCandidates(providers, models, policy, context = {}) {
  let filteredProviders = providers.filter((p) => p.status === "active" || p.configured);
  if (policy.require_eu) filteredProviders = filteredProviders.filter((p) => p.region === "eu" || p.region === "global");
  if (policy.blocked_providers?.length) {
    filteredProviders = filteredProviders.filter((p) => !policy.blocked_providers.includes(p.id));
  }
  if (policy.preferred_providers?.length) {
    const preferred = filteredProviders.filter((p) => policy.preferred_providers.includes(p.id));
    if (preferred.length) filteredProviders = preferred;
  }

  let filteredModels = models.filter((m) => m.availability === "active" && !m.deprecated);
  if (policy.require_gdpr) filteredModels = filteredModels.filter((m) => m.gdprCompatible && m.euAvailable);
  if (context.explicitModelId) filteredModels = filteredModels.filter((m) => m.id === context.explicitModelId);
  if (context.requiredCapabilities) {
    const caps = context.requiredCapabilities;
    if (caps.vision) filteredModels = filteredModels.filter((m) => m.supportsVision);
    if (caps.reasoning) filteredModels = filteredModels.filter((m) => m.supportsReasoning);
    if (caps.json) filteredModels = filteredModels.filter((m) => m.supportsJson);
  }

  return { providers: filteredProviders, models: filteredModels };
}

/**
 * Routing Engine V2 — no hardcoded provider logic.
 * Scores all provider+model pairs and selects best; fallback chain from policy.
 */
async function resolveRoute(context = {}) {
  const policy = await loadRoutingPolicy(context);
  const [providers, models] = await Promise.all([
    providerRegistry.getAll(),
    modelRegistry.getActive(),
  ]);

  if (context.explicitProviderId && context.explicitModelId) {
    const provider = providers.find((p) => p.id === context.explicitProviderId);
    const model = models.find((m) => m.id === context.explicitModelId) || (await modelRegistry.getById(context.explicitModelId));
    return {
      provider,
      model,
      routingReason: "Explicit provider and model selected.",
      policy: policy.name || "explicit",
      score: 1,
      fallbackChain: policy.fallback_chain || [],
    };
  }

  const { providers: candProviders, models: candModels } = filterCandidates(providers, models, policy, context);

  const scores = [];
  for (const model of candModels) {
    const provider = candProviders.find((p) => p.id === model.providerId);
    if (!provider) continue;
    if (policy.max_latency_ms && provider.avgLatencyMs > policy.max_latency_ms) continue;
    scores.push(scoreProvider(provider, model, policy, context));
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best) {
    const chain = policy.fallback_chain || [];
    for (const pid of chain) {
      const provider = providers.find((p) => p.id === pid);
      const model = models.find((m) => m.providerId === pid);
      if (provider && model) {
        return {
          provider,
          model,
          routingReason: `Fallback chain selected ${pid}.`,
          policy: policy.name || "fallback",
          score: 0,
          fallbackChain: chain,
          fallbackUsed: true,
        };
      }
    }
    throw new Error("No routable provider/model available for current policy.");
  }

  const provider = providers.find((p) => p.id === best.providerId);
  const model = models.find((m) => m.id === best.modelId);

  return {
    provider,
    model,
    routingReason: `V2 score ${best.score} (health/cost/latency/region/gdpr weighted).`,
    policy: policy.name || "default",
    score: best.score,
    scoreBreakdown: best.breakdown,
    fallbackChain: policy.fallback_chain || [],
    fallbackUsed: false,
  };
}

function generateTraceId() {
  return `tr_${crypto.randomBytes(12).toString("hex")}`;
}

module.exports = {
  loadRoutingPolicy,
  scoreProvider,
  filterCandidates,
  resolveRoute,
  generateTraceId,
  DEFAULT_WEIGHTS,
};
