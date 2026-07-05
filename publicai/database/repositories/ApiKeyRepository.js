(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaApiKeyRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "apikeys", { isArray: false });

    return {
      ...base,
      findAll() {
        return adapter.findAll("apikeys");
      },
      getKeys() {
        return this.findAll().then((data) => data.keys || []);
      },
      getActivity() {
        return this.findAll().then((data) => data.activity || []);
      },
      findById(id) {
        return this.getKeys().then((keys) => keys.find((k) => k.id === id) || null);
      },
      createKey(record) {
        return adapter.create("apikeys", record);
      },
      updateKey(id, data) {
        return adapter.update("apikeys", id, data);
      },
      deleteKey(id) {
        return adapter.delete("apikeys", id);
      },
      addActivity(entry) {
        return this.findAll().then((doc) => {
          doc.activity = [entry, ...(doc.activity || [])].slice(0, 20);
          return adapter.setDocument("apikeys", doc);
        });
      },
      setKeys(keys) {
        return this.findAll().then((doc) => adapter.setDocument("apikeys", { ...doc, keys }));
      },
      setActivity(activity) {
        return this.findAll().then((doc) => adapter.setDocument("apikeys", { ...doc, activity }));
      },
    };
  }

  return { create };
});
