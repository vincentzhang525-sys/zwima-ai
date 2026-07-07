const { json, handleOptions, withCors } = require("../lib/supabase");
const providerRegistry = require("../../config/providerRegistry.js");
const providerRuntime = require("../../gateway/providerRuntime.js");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const providers = providerRuntime.getProvidersView().map((p) => ({
      providerId: p.id,
      providerName: p.name,
      status: p.status,
      enabled: p.enabled,
      modelList: p.modelList,
      supportsVision: p.supportsVision,
      supportsStreaming: p.supportsStreaming,
      supportsJsonMode: p.supportsJsonMode,
      supportsEmbedding: p.supportsEmbedding,
      supportsImageGeneration: p.supportsImageGeneration,
      apiBaseUrl: p.apiBaseUrl,
      healthStatus: p.healthStatus,
      lastCheck: p.lastCheck,
      priority: p.priority,
      defaultModel: p.defaultModel,
      configured: p.configured,
    }));
    return json(res, 200, { providers, count: providers.length });
  } catch (err) {
    console.error("[gateway/providers]", err);
    return json(res, 500, { error: err.message || "Failed to load providers" });
  }
};
