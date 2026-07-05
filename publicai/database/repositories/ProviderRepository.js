(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaProviderRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "providers", { isArray: false });

    return {
      ...base,
      findAll() {
        return adapter.findAll("providers").then((map) => ({
          map,
          list: Object.values(map),
        }));
      },
      findById(id) {
        return adapter.findAll("providers").then((map) => map[id] || map.openai);
      },
      getMap() {
        return adapter.findAll("providers");
      },
      getList() {
        return this.findAll().then((data) => data.list);
      },
    };
  }

  return { create };
});
