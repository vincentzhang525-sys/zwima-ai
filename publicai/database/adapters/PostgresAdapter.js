(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaPostgresAdapter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createPostgresAdapter() {
    const stub = () => Promise.reject(new Error("PostgresAdapter is reserved for a future release. Use MockAdapter."));
    return {
      driver: "PostgresAdapter",
      database: "PostgreSQL (reserved)",
      init: stub,
      ping: stub,
      getHealth: () =>
        Promise.resolve({
          database: "PostgreSQL (reserved)",
          driver: "PostgresAdapter",
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
  return { createPostgresAdapter };
});
