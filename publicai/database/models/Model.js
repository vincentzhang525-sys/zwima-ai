(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaModelModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return { table: "models", idField: "id" };
});
