const { getAdminClient } = require("../supabase");
const legacyRegistry = require("../../config/modelRegistry.js");

function mapModel(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    alias: row.alias,
    version: row.version,
    apiModelId: row.api_model_id,
    inputPricePer1m: Number(row.input_price_per_1m),
    outputPricePer1m: Number(row.output_price_per_1m),
    cachedInputPricePer1m: Number(row.cached_input_price_per_1m),
    contextLength: row.context_length,
    maxOutputTokens: row.max_output_tokens,
    supportsVision: row.supports_vision,
    supportsStreaming: row.supports_streaming,
    supportsJson: row.supports_json,
    supportsBatch: row.supports_batch,
    supportsFunctionCalling: row.supports_function_calling,
    supportsReasoning: row.supports_reasoning,
    avgLatencyMs: row.avg_latency_ms,
    availability: row.availability,
    euAvailable: row.eu_available,
    gdprCompatible: row.gdpr_compatible,
    deprecated: row.deprecated,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadFromDb(filters = {}) {
  const admin = getAdminClient();
  let query = admin.from("commercial_models").select("*").order("provider_id");
  if (filters.providerId) query = query.eq("provider_id", filters.providerId);
  if (filters.availability) query = query.eq("availability", filters.availability);
  if (filters.euOnly) query = query.eq("eu_available", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapModel);
}

function loadFromLegacy() {
  return legacyRegistry.getAll().map((m) => ({
    id: m.id,
    providerId: m.provider,
    name: m.displayName,
    alias: m.id,
    apiModelId: m.apiId,
    inputPricePer1m: m.inputCost,
    outputPricePer1m: m.outputCost,
    cachedInputPricePer1m: 0,
    contextLength: m.contextLength,
    maxOutputTokens: 8192,
    supportsVision: m.supportsVision,
    supportsStreaming: m.supportsStreaming,
    supportsJson: m.supportsJson,
    supportsFunctionCalling: m.supportsFunctionCalling,
    supportsReasoning: legacyRegistry.isReasoningModel(m.id),
    availability: m.status,
    euAvailable: m.provider === "google" || m.provider === "mistral",
    gdprCompatible: m.provider === "google" || m.provider === "mistral",
    deprecated: false,
    source: "legacy",
  }));
}

async function getAll(filters = {}) {
  try {
    const rows = await loadFromDb(filters);
    if (rows.length) return rows;
  } catch (err) {
    console.warn("[commercial/modelRegistry] DB fallback to legacy:", err.message);
  }
  return loadFromLegacy();
}

async function getById(id) {
  try {
    const admin = getAdminClient();
    const { data } = await admin.from("commercial_models").select("*").eq("id", id).maybeSingle();
    if (data) return mapModel(data);
  } catch {
    /* fallback */
  }
  const legacy = legacyRegistry.getById(id);
  if (!legacy) return null;
  return loadFromLegacy().find((m) => m.id === id);
}

async function getByProvider(providerId) {
  return getAll({ providerId });
}

async function getActive() {
  const all = await getAll();
  return all.filter((m) => m.availability === "active" && !m.deprecated);
}

module.exports = { mapModel, getAll, getById, getByProvider, getActive, loadFromDb, loadFromLegacy };
