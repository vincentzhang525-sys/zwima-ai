(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaUniversalRouter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const modelRegistry =
    typeof ZwimaModelRegistry !== "undefined" ? ZwimaModelRegistry : require("../config/modelRegistry.js");
  const providerRegistry =
    typeof ZwimaProviderRegistry !== "undefined" ? ZwimaProviderRegistry : require("../config/providerRegistry.js");
  const ProviderAdapters =
    typeof ZwimaProviderAdapters !== "undefined" ? ZwimaProviderAdapters : require("./adapters");
  const providerRuntime =
    typeof ZwimaProviderRuntime !== "undefined" ? ZwimaProviderRuntime : require("./providerRuntime");

  function detectTask(prompt) {
    const text = String(prompt || "").toLowerCase();
    if (/(code|debug|fix|refactor|function|typescript|javascript|python|sql)/.test(text)) return "coding";
    if (/(cheap|low cost|fast|quick|brief|short)/.test(text)) return "fast";
    if (/(explain|detailed|deep dive|step by step|long)/.test(text)) return "long";
    return "chat";
  }

  function chooseModel(prompt, explicitModel, routingMode = "intelligent") {
    if (explicitModel) {
      const modelId = modelRegistry.resolveId(explicitModel);
      return { modelId, reason: "Explicit model selected." };
    }
    if (routingMode === "manual") return { modelId: "gpt-4o", reason: "Manual mode default model." };
    const task = detectTask(prompt);
    if (task === "coding") return { modelId: "gpt-4.1", reason: "Coding task routed to GPT-4.1." };
    if (task === "fast") return { modelId: "gemini-2-flash", reason: "Low-cost / fast task routed to Gemini Flash." };
    if (task === "long") return { modelId: "gemini-2-pro", reason: "Long explanation routed to Gemini Pro." };
    return { modelId: "gpt-4o", reason: "General chat routed to GPT-4o." };
  }

  function resolveRoute({ provider, model, prompt, routingMode }) {
    const picked = chooseModel(prompt, model, routingMode);
    const modelId = picked.modelId;
    const modelMeta = modelRegistry.getById(modelId);
    const providerId = provider || modelMeta?.provider || "openai";
    const adapterId = providerRegistry.getAdapterId(providerId);
    return { modelId, modelMeta, providerId, adapterId, routingReason: picked.reason };
  }

  function buildUnifiedResponse(result, route, elapsedMs) {
    const usage = result.usage || {};
    const inputTokens = Number(usage.inputTokens ?? usage.promptTokens) || 0;
    const outputTokens = Number(usage.outputTokens ?? usage.completionTokens) || 0;
    const totalTokens = Number(usage.totalTokens) || inputTokens + outputTokens;
    const modelMeta = route.modelMeta || modelRegistry.getById(route.modelId);
    return {
      content: result.content || "",
      model: {
        id: route.modelId,
        displayName: modelMeta?.displayName || route.modelId,
        apiId: modelRegistry.resolveApiId(route.modelId),
      },
      usage: { inputTokens, outputTokens, totalTokens },
      latencyMs: Number(result.latency ?? elapsedMs) || elapsedMs,
      finishReason: result.finishReason || "stop",
      routingReason: route.routingReason,
      fallbackReason: result.fallbackReason || null,
      estimatedCost: Number(usage.estimatedCost) || 0,
    };
  }

  async function routeChat(input) {
    const {
      provider,
      model,
      prompt,
      systemPrompt,
      temperature = 0.7,
      options = {},
      messages,
      maxTokens,
      routingMode,
    } = input;

    const route = resolveRoute({ provider, model, prompt, routingMode });
    const adapter = ProviderAdapters.getAdapter(route.adapterId);
    if (!adapter) throw new Error(`No adapter for provider: ${route.providerId}`);

    const started = Date.now();
    let result;
    let effectiveModelId = route.modelId;
    let effectiveProviderId = route.providerId;

    try {
      result = await adapter.chat({
        prompt,
        messages,
        model: modelRegistry.resolveApiId(route.modelId),
        system: systemPrompt,
        temperature,
        maxTokens: maxTokens ?? options.maxTokens ?? 1024,
        ...options,
      });
    } catch (primaryErr) {
      const enabled = providerRegistry.getEnabled(providerRuntime.getRuntimeMap());
      const fallback = enabled.find((p) => p.id !== route.providerId && p.configured);
      if (!fallback) throw primaryErr;
      const fallbackAdapter = ProviderAdapters.getAdapter(providerRegistry.getAdapterId(fallback.id));
      if (!fallbackAdapter) throw primaryErr;
      effectiveProviderId = fallback.id;
      effectiveModelId = fallback.defaultModel;
      result = await fallbackAdapter.chat({
        prompt,
        messages,
        model: modelRegistry.resolveApiId(effectiveModelId),
        system: systemPrompt,
        temperature,
        maxTokens: maxTokens ?? options.maxTokens ?? 1024,
        ...options,
      });
      result.fallbackReason = primaryErr.message;
    }

    const elapsedMs = Date.now() - started;
    providerRuntime.recordRequest(effectiveProviderId, { latencyMs: elapsedMs });
    return buildUnifiedResponse(result, { ...route, modelId: effectiveModelId, providerId: effectiveProviderId }, elapsedMs);
  }

  function estimatedCost(inputTokens, outputTokens, modelId) {
    const model = modelRegistry.getById(modelRegistry.resolveId(modelId));
    const inputPrice = Number(model?.inputCost) || 0;
    const outputPrice = Number(model?.outputCost) || 0;
    return Number((((inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000)).toFixed(6));
  }

  return {
    routeChat,
    chooseModel,
    resolveRoute,
    buildUnifiedResponse,
    estimatedCost,
    defaultSystemPrompt: "You are a helpful AI assistant on the ZWIMA API Gateway.",
  };
});
