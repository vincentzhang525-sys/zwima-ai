(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAdminStatsRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function create(adapter) {
    return {
      getStatistics() {
        return adapter.findAll("admin").then((doc) => doc.statistics || {});
      },
      async bumpStats(patch) {
        const doc = adapter.getDocument("admin");
        doc.statistics = { ...doc.statistics, ...patch };
        await adapter.setDocument("admin", doc);
        return doc.statistics;
      },
    };
  }

  return { create };
});
