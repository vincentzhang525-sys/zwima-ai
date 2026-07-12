const { getAdminClient } = require("../supabase");
const legacyRegistry = require("../../config/providerRegistry.js");

function mapProvider(row) {
  if (!row) return null;
  const configured = row.api_key_env ? Boolean(process.env[row.api_key_env]) : false;
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    status: row.status,
    priority: row.priority,
    region: row.region,
    baseUrl: row.base_url,
    authMethod: row.auth_method,
    apiKeyEnv: row.api_key_env,
    organizationId: row.organization_id,
    currency: row.currency,
    healthStatus: row.health_status,
    healthScore: Number(row.health_score),
    avgLatencyMs: row.avg_latency_ms,
    avgCostPer1mTokens: Number(row.avg_cost_per_1m_tokens),
    profitMarginPct: Number(row.profit_margin_pct),
    rateLimitRpm: row.rate_limit_rpm,
    dailyLimit: row.daily_limit,
    monthlyLimit: row.monthly_limit,
    adapterId: row.adapter_id,
    supports: {
      vision: row.supports_vision,
      image: row.supports_image,
      audio: row.supports_audio,
      embedding: row.supports_embedding,
      functionCalling: row.supports_function_calling,
      jsonMode: row.supports_json_mode,
      streaming: row.supports_streaming,
      reasoning: row.supports_reasoning,
    },
    configured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadFromDb(filters = {}) {
  const admin = getAdminClient();
  let query = admin.from("commercial_providers").select("*").order("priority");
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.region) query = query.eq("region", filters.region);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapProvider);
}

function loadFromLegacy() {
  return legacyRegistry.getAll().map((p) => ({
    id: p.id,
    name: p.name,
    providerType: "llm",
    status: p.enabled ? "active" : p.status === "inactive" ? "inactive" : "disabled",
    priority: p.priority,
    region: p.id === "google" ? "global" : "us",
    baseUrl: p.apiBaseUrl,
    authMethod: "api_key",
    healthStatus: p.healthStatus,
    healthScore: p.healthStatus === "online" ? 95 : p.configured ? 50 : 0,
    avgLatencyMs: p.latencyMs || 0,
    adapterId: p.adapterId,
    configured: p.configured,
    supports: {
      vision: p.supportsVision,
      image: p.supportsImageGeneration,
      audio: false,
      embedding: p.supportsEmbedding,
      functionCalling: true,
      jsonMode: p.supportsJsonMode,
      streaming: p.supportsStreaming,
      reasoning: false,
    },
    source: "legacy",
  }));
}

async function getAll(filters = {}) {
  try {
    const rows = await loadFromDb(filters);
    if (rows.length) return rows;
  } catch (err) {
    console.warn("[commercial/providerRegistry] DB fallback to legacy:", err.message);
  }
  return loadFromLegacy();
}

async function getById(id) {
  try {
    const admin = getAdminClient();
    const { data } = await admin.from("commercial_providers").select("*").eq("id", id).maybeSingle();
    if (data) return mapProvider(data);
  } catch {
    /* fallback */
  }
  const legacy = legacyRegistry.getById(id);
  return legacy ? loadFromLegacy().find((p) => p.id === id) : null;
}

async function getActive() {
  const all = await getAll();
  return all.filter((p) => p.status === "active" && p.configured !== false);
}

module.exports = { mapProvider, getAll, getById, getActive, loadFromDb, loadFromLegacy };
