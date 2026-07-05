(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaInvoiceRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "invoices", { isArray: false, idField: "id" });

    function getStore() {
      const doc = adapter.getDocument("invoices");
      if (!doc.invoices) doc.invoices = [];
      return doc;
    }

    function nextInvoiceId() {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      return `INV-${date}-${String(Date.now()).slice(-4)}`;
    }

    return {
      ...base,
      findAll() {
        return adapter.findAll("invoices").then((doc) => doc.invoices || []);
      },
      findById(id) {
        return this.findAll().then((rows) => rows.find((i) => i.id === id) || null);
      },
      async create(record) {
        const doc = getStore();
        doc.invoices = [record, ...doc.invoices];
        await adapter.setDocument("invoices", doc);
        return record;
      },
      createFromPayment(payment) {
        const invoice = {
          id: nextInvoiceId(),
          paymentId: payment.id,
          userId: payment.userId,
          date: new Date().toISOString().slice(0, 10),
          amountEur: payment.amountEur,
          baseAmountEur: payment.baseAmountEur,
          vatEur: payment.vatEur,
          credits: payment.credits,
          currency: payment.currency || "EUR",
          status: "paid",
          provider: payment.provider || "Stripe",
          createdAt: new Date().toISOString(),
        };
        return this.create(invoice);
      },
      getList() {
        return this.findAll().then((rows) =>
          [...rows].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
        );
      },
    };
  }

  return { create };
});
