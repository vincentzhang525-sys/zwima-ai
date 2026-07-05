(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaPaymentRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "payments", { isArray: false, idField: "id" });

    function getStore() {
      const doc = adapter.getDocument("payments");
      if (!doc.payments) doc.payments = [];
      return doc;
    }

    return {
      ...base,
      findAll() {
        return adapter.findAll("payments").then((doc) => doc.payments || []);
      },
      findById(id) {
        return this.findAll().then((rows) => rows.find((p) => p.id === id) || null);
      },
      findBySessionId(sessionId) {
        return this.findAll().then((rows) => rows.find((p) => p.sessionId === sessionId) || null);
      },
      findByPaymentIntentId(paymentIntentId) {
        return this.findAll().then((rows) => rows.find((p) => p.paymentIntentId === paymentIntentId) || null);
      },
      async create(record) {
        const doc = getStore();
        doc.payments = [record, ...doc.payments];
        await adapter.setDocument("payments", doc);
        return record;
      },
      async update(id, patch) {
        const doc = getStore();
        const idx = doc.payments.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        doc.payments[idx] = { ...doc.payments[idx], ...patch };
        await adapter.setDocument("payments", doc);
        return doc.payments[idx];
      },
      getHistory() {
        return this.findAll().then((rows) =>
          [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        );
      },
    };
  }

  return { create };
});
