(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAuthRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const AuthEngine = typeof ZwimaAuthEngine !== "undefined" ? ZwimaAuthEngine : require("../../auth/authEngine");

  function create(adapter) {
    function getAuthStore() {
      return adapter.getDocument("auth");
    }
    function saveAuthStore(store) {
      return adapter.setDocument("auth", store);
    }
    const engine = AuthEngine.createAuthEngine(getAuthStore, saveAuthStore);

    return {
      ...engine,
      findAll() {
        return adapter.findAll("auth");
      },
      findById(id) {
        const store = getAuthStore();
        return Promise.resolve(store.accounts.find((a) => a.id === id) || null);
      },
      create(data) {
        const store = getAuthStore();
        store.accounts.push(data);
        saveAuthStore(store);
        return Promise.resolve(data);
      },
      update(id, data) {
        const store = getAuthStore();
        const idx = store.accounts.findIndex((a) => a.id === id);
        if (idx === -1) return Promise.resolve(null);
        store.accounts[idx] = { ...store.accounts[idx], ...data };
        saveAuthStore(store);
        return Promise.resolve(store.accounts[idx]);
      },
      delete(id) {
        const store = getAuthStore();
        store.accounts = store.accounts.filter((a) => a.id !== id);
        saveAuthStore(store);
        return Promise.resolve(true);
      },
    };
  }

  return { create };
});
