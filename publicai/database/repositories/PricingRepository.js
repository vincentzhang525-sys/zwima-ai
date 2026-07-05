(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaPricingRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function create(adapter) {
    function getDoc() {
      return adapter.getDocument("admin");
    }

    return {
      findAll() {
        return adapter.findAll("admin").then((doc) => doc.pricing || []);
      },
      async update(id, patch) {
        const doc = getDoc();
        const idx = doc.pricing.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        doc.pricing[idx] = { ...doc.pricing[idx], ...patch };
        if (patch.tokenCost != null && patch.sellPrice != null) {
          doc.pricing[idx].margin = Math.round(((patch.sellPrice - patch.tokenCost) / patch.sellPrice) * 100);
        }
        await adapter.setDocument("admin", doc);
        return doc.pricing[idx];
      },
    };
  }

  return { create };
});
