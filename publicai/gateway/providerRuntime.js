(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaProviderRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const providerRegistry =
    typeof ZwimaProviderRegistry !== "undefined" ? ZwimaProviderRegistry : require("../config/providerRegistry.js");

  const runtime = {};
  const health = {};
  const stats = {};

  function initRuntime() {
    providerRegistry.PROVIDER_DEFS.forEach((def) => {
      if (!runtime[def.id]) {
        runtime[def.id] = {
          enabled: def.enabled && providerRegistry.isConfigured(def),
          priority: def.priority,
          defaultModel: def.defaultModel,
        };
      }
    });
  }
  initRuntime();

  function getRuntimeMap() {
    return { ...runtime };
  }

  function getHealthMap() {
    return { ...health };
  }

  function updateProvider(id, patch) {
    if (!providerRegistry.getDefinition(id)) return null;
    runtime[id] = { ...runtime[id], ...patch };
    return runtime[id];
  }

  function recordHealth(id, snapshot) {
    health[id] = { ...health[id], ...snapshot, lastCheck: new Date().toISOString() };
    return health[id];
  }

  function recordRequest(id, { latencyMs } = {}) {
    stats[id] = stats[id] || { totalRequests: 0, lastRequest: null, latencyMs: 0 };
    stats[id].totalRequests += 1;
    stats[id].lastRequest = new Date().toISOString();
    if (latencyMs != null) stats[id].latencyMs = latencyMs;
    return stats[id];
  }

  function getStats(id) {
    return stats[id] || { totalRequests: 0, lastRequest: null, latencyMs: 0 };
  }

  function getProvidersView() {
    const healthMap = {};
    Object.keys(health).forEach((id) => {
      healthMap[id] = {
        healthStatus: health[id].healthStatus,
        lastCheck: health[id].lastCheck,
        latencyMs: health[id].latencyMs,
        totalRequests: getStats(id).totalRequests,
        lastRequest: getStats(id).lastRequest,
      };
    });
    Object.keys(stats).forEach((id) => {
      healthMap[id] = {
        ...(healthMap[id] || {}),
        totalRequests: stats[id].totalRequests,
        lastRequest: stats[id].lastRequest,
        latencyMs: stats[id].latencyMs,
      };
    });
    return providerRegistry.getAll(runtime, healthMap);
  }

  return {
    getRuntimeMap,
    getHealthMap,
    updateProvider,
    recordHealth,
    recordRequest,
    getStats,
    getProvidersView,
  };
});
