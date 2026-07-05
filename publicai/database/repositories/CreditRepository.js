(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaCreditRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function formatBalance(n) {
    return Number(n).toLocaleString("en-US");
  }

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "credits", { isArray: false, idField: "id" });

    return {
      ...base,
      findAll() {
        return adapter.findAll("credits");
      },
      getOverview() {
        return this.findAll().then((data) => data.overview);
      },
      async addCredits(amount) {
        const doc = await this.findAll();
        const delta = Number(amount);
        doc.overview.balance = Math.max(0, (doc.overview.balance || 0) + delta);
        doc.overview.balanceLabel = `${formatBalance(doc.overview.balance)} Credits`;
        await adapter.setDocument("credits", doc);
        return doc.overview;
      },
      async getBillingDashboard() {
        const [credits, billing] = await Promise.all([this.findAll(), adapter.findAll("billing")]);
        const monthlySpend =
          billing.monthlySpending?.[billing.monthlySpending.length - 1]?.amount || 0;
        return {
          currentBalance: credits.overview.balance,
          balanceLabel: credits.overview.balanceLabel,
          monthlySpend,
          monthlySpendLabel: `€${monthlySpend}`,
          autoRecharge: credits.billingSettings?.autoRecharge ?? true,
          alertThreshold: credits.billingSettings?.alertThreshold ?? 2000,
          monthlyLimit: credits.billingSettings?.monthlyLimit ?? 5000,
        };
      },
      async updateBillingSettings(patch) {
        const doc = await this.findAll();
        doc.billingSettings = { ...(doc.billingSettings || {}), ...patch };
        await adapter.setDocument("credits", doc);
        return doc.billingSettings;
      },
      findById() {
        return this.findAll();
      },
    };
  }

  return { create };
});
