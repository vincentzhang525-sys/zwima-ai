(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaTransactionRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "billing", { isArray: false, idField: "id" });

    function getBillingDoc() {
      return adapter.getDocument("billing");
    }

    return {
      ...base,
      findAll() {
        const doc = getBillingDoc();
        return Promise.resolve(doc.transactions || []);
      },
      async create(record) {
        const doc = getBillingDoc();
        const row = { id: `tx-${Date.now()}`, ...record };
        doc.transactions = [row, ...(doc.transactions || [])];
        await adapter.setDocument("billing", doc);
        return row;
      },
      getHistory() {
        return this.findAll();
      },
      findById(id) {
        return this.findAll().then((rows) => rows.find((t) => t.id === id) || null);
      },
    };
  }

  return { create };
});
