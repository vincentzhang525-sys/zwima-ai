(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaRoutingModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return { table: "routing", idField: "id" };
});
