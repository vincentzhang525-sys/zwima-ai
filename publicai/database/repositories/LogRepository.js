(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaLogRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "logs", { isArray: false, idField: "id" });

    return {
      ...base,
      findAll() {
        return adapter.findAll("logs");
      },
      getRequestLogs() {
        return this.findAll().then((data) => data.requestLogs || []);
      },
      getGatewayProviders() {
        return this.findAll().then((data) => data.gatewayProviders || []);
      },
      getHealth() {
        return this.findAll().then((data) => data.health || []);
      },
      getRateLimits() {
        return this.findAll().then((data) => data.rateLimits || []);
      },
      getGatewayStatistics() {
        return this.findAll().then((data) => ({
          todayRequests: 1200 + Math.floor(Math.random() * 80),
          avgLatency: 230 + Math.floor(Math.random() * 40),
          successRate: (99.4 + Math.random() * 0.4).toFixed(1),
          tokenUsage: data.gatewayStatistics?.tokenUsage || "3.2M",
        }));
      },
      getSdkMessage() {
        return this.findAll().then((data) => data.sdkMessage);
      },
      findById(id) {
        return this.getRequestLogs().then((logs) => logs.find((l) => l.id === id) || null);
      },
    };
  }

  return { create };
});
