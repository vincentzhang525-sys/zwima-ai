(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaUserRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "users", { isArray: false, idField: "id" });

    return {
      ...base,
      findAll() {
        return adapter.findAll("users");
      },
      findById(id) {
        return this.findAll().then((user) => (user.id === id ? user : user));
      },
      update(id, data) {
        return adapter.update("users", id, data);
      },
      getSession() {
        const session = adapter.getSession?.();
        if (session) return Promise.resolve(session);
        return this.findAll();
      },
      saveSession(data) {
        return this.findAll().then((user) => {
          const next = { ...user, ...data };
          adapter.setSession?.(next);
          return adapter.setDocument("users", next);
        });
      },
      clearSession() {
        adapter.clearSession?.();
        return Promise.resolve(null);
      },
    };
  }

  return { create };
});
