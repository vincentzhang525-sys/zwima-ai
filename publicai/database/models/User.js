(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaUserModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return { table: "users", idField: "id" };
});
