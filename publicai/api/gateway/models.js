const { json, handleOptions, withCors } = require("../lib/supabase");
const modelRegistry = require("../../config/modelRegistry.js");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const provider = String(req.query?.provider || "").trim();
    const models = (provider ? modelRegistry.getByProvider(provider) : modelRegistry.getAll()).map((m) => ({
      modelId: m.id,
      displayName: m.displayName,
      provider: m.provider,
      providerName: modelRegistry.getProviderName(m.provider),
      contextLength: m.contextLength,
      inputCost: m.inputCost,
      outputCost: m.outputCost,
      supportsVision: m.supportsVision,
      supportsFunctionCalling: m.supportsFunctionCalling,
      supportsJson: m.supportsJson,
      supportsStreaming: m.supportsStreaming,
      status: m.status,
      apiId: m.apiId,
    }));
    return json(res, 200, { models, count: models.length });
  } catch (err) {
    console.error("[gateway/models]", err);
    return json(res, 500, { error: err.message || "Failed to load models" });
  }
};
