(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaDatabaseHealth = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toHealthItems(health) {
    return [
      { name: "Database", status: health.database, statusClass: "active" },
      { name: "Driver", status: health.driver, statusClass: "active" },
      { name: "Status", status: health.status, statusClass: health.status === "Operational" ? "active" : "planned" },
      { name: "Latency", status: health.latency, statusClass: "active" },
      { name: "Records", status: String(health.records), statusClass: "active" },
    ];
  }

  return {
    async getHealth(adapter) {
      const health = await adapter.getHealth();
      return { ...health, items: toHealthItems(health) };
    },
    toHealthItems,
  };
});
