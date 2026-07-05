(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaSQLiteAdapter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createSQLiteAdapter() {
    const stub = () => Promise.reject(new Error("SQLiteAdapter is reserved for a future release. Use MockAdapter."));
    return {
      driver: "SQLiteAdapter",
      database: "SQLite (reserved)",
      init: stub,
      ping: stub,
      getHealth: () =>
        Promise.resolve({
          database: "SQLite (reserved)",
          driver: "SQLiteAdapter",
          status: "Not configured",
          latency: "—",
          records: 0,
        }),
      findAll: stub,
      findById: stub,
      create: stub,
      update: stub,
      delete: stub,
      getDocument: stub,
      setDocument: stub,
    };
  }
  return { createSQLiteAdapter };
});
