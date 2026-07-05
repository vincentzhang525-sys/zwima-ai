(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaHealthMonitor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GatewayConfig =
    typeof ZwimaGatewayConfig !== "undefined" ? ZwimaGatewayConfig : require("./gatewayConfig");
  const ProviderAdapters =
    typeof ZwimaProviderAdapters !== "undefined" ? ZwimaProviderAdapters : require("./adapters");

  function createHealthMonitor(providerManager) {
    let timer = null;
    let lastResults = [];

    async function checkAll() {
      const enabled = providerManager.getEnabledProviders();
      const results = await Promise.all(
        enabled.map(async ({ id }) => {
          const adapter = ProviderAdapters.getAdapter(id);
          if (!adapter) return { providerId: id, provider: id, status: "unknown", latency: 0, availability: 0 };
          const health = await adapter.health();
          return { providerId: id, ...health };
        })
      );
      lastResults = results;
      const snapshot = {};
      results.forEach((r) => {
        snapshot[r.providerId] = {
          provider: r.provider,
          status: r.status,
          latency: r.latency,
          availability: r.availability,
          checkedAt: new Date().toISOString(),
        };
      });
      providerManager.saveHealthSnapshot(snapshot);
      return results;
    }

    return {
      async checkAll() {
        return checkAll();
      },
      getLastResults() {
        return lastResults;
      },
      start() {
        if (timer) return;
        const tick = () => checkAll().catch(() => {});
        tick();
        timer = setInterval(tick, GatewayConfig.getHealthIntervalMs());
        if (timer.unref) timer.unref();
      },
      stop() {
        if (timer) clearInterval(timer);
        timer = null;
      },
    };
  }

  return { createHealthMonitor };
});
