(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaDatabaseAdapter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MockAdapter = typeof ZwimaMockAdapter !== "undefined" ? ZwimaMockAdapter : require("./adapters/MockAdapter");
  const SQLiteAdapter = typeof ZwimaSQLiteAdapter !== "undefined" ? ZwimaSQLiteAdapter : require("./adapters/SQLiteAdapter");
  const PostgresAdapter = typeof ZwimaPostgresAdapter !== "undefined" ? ZwimaPostgresAdapter : require("./adapters/PostgresAdapter");

  function createAdapter(type, options) {
    const driver = (type || (typeof window !== "undefined" ? window.ZWIMA_CONFIG?.DB_DRIVER : null) || "mock").toLowerCase();
    if (driver === "sqlite") return SQLiteAdapter.createSQLiteAdapter(options);
    if (driver === "postgres" || driver === "postgresql") return PostgresAdapter.createPostgresAdapter(options);
    return MockAdapter.createMockAdapter(options);
  }

  return { createAdapter };
});
