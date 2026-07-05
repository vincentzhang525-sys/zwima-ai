(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaGatewayRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GatewayMod = typeof ZwimaGateway !== "undefined" ? ZwimaGateway : require("../../gateway/gateway");

  function create(adapter) {
    function getConfig() {
      return adapter.getDocument("gateway");
    }
    function saveConfig(cfg) {
      return adapter.setDocument("gateway", cfg);
    }

    const gateway = GatewayMod.createGateway(getConfig, saveConfig);

    return {
      ...gateway,
      findAll() {
        return adapter.findAll("gateway");
      },
      getProviderManager() {
        return gateway.providerManager;
      },
      getRoutingEngine() {
        return gateway.routingEngine;
      },
      getHealthMonitor() {
        return gateway.healthMonitor;
      },
    };
  }

  return { create };
});
