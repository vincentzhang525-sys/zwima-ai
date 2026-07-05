(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaBillingRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "billing", { isArray: false, idField: "id" });

    return {
      ...base,
      findAll() {
        return adapter.findAll("billing");
      },
      getUsageStatistics() {
        return this.findAll().then((data) => data.usageStatistics);
      },
      getTransactions() {
        return this.findAll().then((data) => data.transactions || []);
      },
      getCostBreakdown() {
        return this.findAll().then((data) => data.costBreakdown || []);
      },
      getProviderUsage() {
        return this.findAll().then((data) => data.providerUsage || []);
      },
      getMonthlySpending() {
        return this.findAll().then((data) => data.monthlySpending || []);
      },
      getPaymentMethods() {
        return this.findAll().then((data) => data.paymentMethods || []);
      },
      findById(id) {
        return this.getTransactions().then((rows) => rows.find((r) => r.id === id) || null);
      },
    };
  }

  return { create };
});
