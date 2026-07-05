(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaBillingModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return { table: "billing", idField: "id" };
});
