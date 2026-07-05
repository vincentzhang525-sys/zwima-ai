(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAuditLogRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function create(adapter) {
    function getDoc() {
      const doc = adapter.getDocument("admin");
      if (!doc.auditLog) doc.auditLog = [];
      return doc;
    }

    return {
      findAll() {
        return adapter.findAll("admin").then((doc) => doc.auditLog || []);
      },
      async append(entry) {
        const doc = getDoc();
        const row = {
          id: `audit-${Date.now()}`,
          time: new Date().toISOString().replace("T", " ").slice(0, 16),
          ...entry,
        };
        doc.auditLog = [row, ...(doc.auditLog || [])].slice(0, 100);
        await adapter.setDocument("admin", doc);
        return row;
      },
    };
  }

  return { create };
});
