(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaGateway = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ProviderAdapters =
    typeof ZwimaProviderAdapters !== "undefined" ? ZwimaProviderAdapters : require("./adapters");
  const ProviderManagerMod =
    typeof ZwimaProviderManager !== "undefined" ? ZwimaProviderManager : require("./providerManager");
  const RoutingEngineMod =
    typeof ZwimaRoutingEngine !== "undefined" ? ZwimaRoutingEngine : require("./routingEngine");
  const HealthMonitorMod =
    typeof ZwimaHealthMonitor !== "undefined" ? ZwimaHealthMonitor : require("./healthMonitor");
  const GatewayConfig =
    typeof ZwimaGatewayConfig !== "undefined" ? ZwimaGatewayConfig : require("./gatewayConfig");

  function createGateway(getConfig, saveConfig) {
    const providerManager = ProviderManagerMod.createProviderManager(getConfig, saveConfig);
    const routingEngine = RoutingEngineMod.createRoutingEngine(providerManager);
    const healthMonitor = HealthMonitorMod.createHealthMonitor(providerManager);

    async function invokeWithRetry(providerId, fn) {
      const chain = providerManager.getFallbackChain(providerId);
      let lastError = null;
      for (const id of chain) {
        const adapter = ProviderAdapters.getAdapter(id);
        if (!adapter) continue;
        const retries = providerManager.getRetry(id);
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            const result = await fn(adapter, id);
            return { ...result, routedProviderId: id };
          } catch (e) {
            lastError = e;
          }
        }
      }
      throw lastError || new Error("All providers failed");
    }

    function normalizeResponse(result, routedProviderId) {
      const usage = result.usage || {};
      const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
      const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
      return {
        provider: result.provider,
        model: result.model,
        content: result.content,
        images: result.images,
        embeddings: result.embeddings,
        audio: result.audio,
        latency: result.latency,
        mode: result.mode,
        fallback: result.fallback || false,
        fallbackReason: result.fallbackReason || null,
        routedProviderId,
        usage: {
          inputTokens,
          outputTokens,
          promptTokens: usage.promptTokens ?? inputTokens,
          completionTokens: usage.completionTokens ?? outputTokens,
          totalTokens: usage.totalTokens || inputTokens + outputTokens,
          estimatedCost: usage.estimatedCost || 0,
        },
      };
    }

    return {
      providerManager,
      routingEngine,
      healthMonitor,
      getMode: GatewayConfig.getMode,

      async listModels(providerId) {
        if (providerId) {
          const adapter = ProviderAdapters.getAdapter(providerId);
          return adapter ? adapter.listModels() : { models: [] };
        }
        const enabled = providerManager.getEnabledProviders();
        const all = await Promise.all(
          enabled.map(async ({ id }) => {
            const adapter = ProviderAdapters.getAdapter(id);
            const data = await adapter.listModels();
            return { providerId: id, ...data };
          })
        );
        return { providers: all };
      },

      route(payload) {
        return routingEngine.selectProvider({
          providerId: payload?.providerId || payload?.provider,
          prompt: payload?.prompt,
          strategy: payload?.strategy,
          priorityOrder: payload?.priorityOrder,
        });
      },

      async chat(payload) {
        const route = routingEngine.selectProvider({
          providerId: payload?.providerId || payload?.provider,
          prompt: payload?.prompt || payload?.messages?.slice(-1)?.[0]?.content,
          strategy: payload?.strategy,
        });
        const result = await invokeWithRetry(route.providerId, (adapter) => adapter.chat(payload));
        return normalizeResponse(result, route.providerId);
      },

      async embeddings(payload) {
        const providerId = payload?.providerId || payload?.provider || "openai";
        const result = await invokeWithRetry(providerId, (adapter) => adapter.embeddings(payload));
        return normalizeResponse(result, providerId);
      },

      async image(payload) {
        const providerId = payload?.providerId || payload?.provider || "openai";
        const result = await invokeWithRetry(providerId, (adapter) => adapter.image(payload));
        return normalizeResponse(result, providerId);
      },

      async audio(payload) {
        const providerId = payload?.providerId || payload?.provider || "openai";
        const result = await invokeWithRetry(providerId, (adapter) => adapter.audio(payload));
        return normalizeResponse(result, providerId);
      },

      async health() {
        return healthMonitor.checkAll();
      },

      startHealthMonitor() {
        healthMonitor.start();
      },

      stopHealthMonitor() {
        healthMonitor.stop();
      },
    };
  }

  return { createGateway };
});
