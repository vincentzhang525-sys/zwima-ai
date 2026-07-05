(function () {
  async function getDb() {
    await window.ZwimaDatabase.init();
    return window.ZwimaDatabase.getRepositories();
  }

  window.ZwimaRoutingService = {
    getRules() {
      return getDb().then((db) => db.routing.getRules());
    },
    getProviderPriority() {
      return getDb().then((db) => db.routing.getProviderPriority());
    },
    getRoutingLog() {
      return getDb().then((db) => db.routing.getRoutingLog());
    },
    getLiveProviderStatus() {
      return getDb().then((db) => db.routing.getLiveStatus());
    },
    getOptimizerMetrics() {
      return getDb().then((db) => db.routing.getOptimizerMetrics());
    },
    simulateRouting(prompt, strategy, priorityOrder) {
      return getDb().then((db) => db.routing.simulateRouting(prompt, strategy, priorityOrder));
    },
    appendRoutingLog(entry) {
      return getDb().then((db) => db.routing.appendLog(entry));
    },
  };
})();
