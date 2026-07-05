(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAdminRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const AdminEngine = typeof ZwimaAdminEngine !== "undefined" ? ZwimaAdminEngine : require("../../admin/adminEngine");

  function create(repos) {
    const engine = AdminEngine.createAdminEngine(repos);
    return { ...engine, findAll() { return repos.adminUsers.findAll(); } };
  }

  return { create };
});
