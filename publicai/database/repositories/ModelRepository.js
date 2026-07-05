(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaModelRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "models", { isArray: false });

    return {
      ...base,
      findAll() {
        return adapter.findAll("models");
      },
      getMarketplace() {
        return this.findAll().then((data) => data.marketplace || []);
      },
      getCatalog() {
        return this.findAll().then((data) => data.catalog || []);
      },
      findById(id) {
        return this.getCatalog().then((catalog) => catalog.find((m) => m.id === id || `${m.providerId}/${m.name}` === id) || null);
      },
    };
  }

  return { create };
});
