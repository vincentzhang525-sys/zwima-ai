const { getAdminClient } = require("../supabase");
const { generateTraceId } = require("./routingEngineV2");

function mapAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    traceId: row.trace_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    apiKeyId: row.api_key_id,
    providerId: row.provider_id,
    modelId: row.model_id,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    providerCost: Number(row.provider_cost),
    customerCharge: Number(row.customer_charge),
    grossMargin: Number(row.gross_margin),
    marginPct: Number(row.margin_pct),
    taxAmount: Number(row.tax_amount),
    finalPrice: Number(row.final_price),
    currency: row.currency,
    latencyMs: row.latency_ms,
    country: row.country,
    region: row.region,
    routingReason: row.routing_reason,
    fallbackUsed: row.fallback_used,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

/**
 * Record a commercial API audit row (Part 5).
 * Does not replace usage_records — complements it with pricing/margin data.
 */
async function recordRequestAudit(payload) {
  const admin = getAdminClient();
  const traceId = payload.traceId || generateTraceId();
  const inputTokens = Number(payload.inputTokens) || 0;
  const outputTokens = Number(payload.outputTokens) || 0;

  const row = {
    trace_id: traceId,
    user_id: payload.userId || null,
    organization_id: payload.organizationId || null,
    workspace_id: payload.workspaceId || null,
    api_key_id: payload.apiKeyId || null,
    provider_id: payload.providerId || null,
    model_id: payload.modelId || null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: payload.totalTokens ?? inputTokens + outputTokens,
    provider_cost: payload.providerCost ?? 0,
    customer_charge: payload.customerCharge ?? 0,
    gross_margin: payload.grossMargin ?? 0,
    margin_pct: payload.marginPct ?? 0,
    tax_amount: payload.taxAmount ?? 0,
    final_price: payload.finalPrice ?? 0,
    currency: payload.currency || "EUR",
    latency_ms: payload.latencyMs ?? 0,
    country: payload.country || null,
    region: payload.region || null,
    routing_reason: payload.routingReason || null,
    fallback_used: Boolean(payload.fallbackUsed),
    status: payload.status || "success",
    error_message: payload.errorMessage || null,
    request_metadata: payload.metadata || {},
  };

  const { data, error } = await admin.from("commercial_api_audits").insert(row).select().single();
  if (error) throw error;
  return mapAudit(data);
}

async function queryAudits(filters = {}, limit = 100) {
  const admin = getAdminClient();
  let query = admin.from("commercial_api_audits").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.organizationId) query = query.eq("organization_id", filters.organizationId);
  if (filters.providerId) query = query.eq("provider_id", filters.providerId);
  if (filters.traceId) query = query.eq("trace_id", filters.traceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapAudit);
}

async function aggregateMetrics(filters = {}) {
  const rows = await queryAudits(filters, 1000);
  const totalRevenue = rows.reduce((s, r) => s + r.customerCharge, 0);
  const totalCost = rows.reduce((s, r) => s + r.providerCost, 0);
  const totalProfit = rows.reduce((s, r) => s + r.grossMargin, 0);
  const avgLatency = rows.length ? rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length : 0;
  return {
    requestCount: rows.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalProviderCost: Number(totalCost.toFixed(2)),
    totalProfit: Number(totalProfit.toFixed(2)),
    avgMarginPct: totalCost > 0 ? Number(((totalProfit / totalCost) * 100).toFixed(2)) : 0,
    avgLatencyMs: Math.round(avgLatency),
  };
}

module.exports = { mapAudit, recordRequestAudit, queryAudits, aggregateMetrics };
