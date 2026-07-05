(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAdminUserRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function create(adapter) {
    function getDoc() {
      return adapter.getDocument("admin");
    }

    return {
      findAll(query) {
        return adapter.findAll("admin").then((doc) => {
          let users = doc.users || [];
          const q = String(query || "").toLowerCase().trim();
          if (q) {
            users = users.filter(
              (u) =>
                u.email.toLowerCase().includes(q) ||
                u.name.toLowerCase().includes(q) ||
                u.company.toLowerCase().includes(q)
            );
          }
          return users;
        });
      },
      findById(id) {
        return this.findAll().then((users) => users.find((u) => u.id === id) || null);
      },
      async setStatus(id, status) {
        const doc = getDoc();
        const idx = doc.users.findIndex((u) => u.id === id);
        if (idx === -1) return null;
        doc.users[idx].status = status;
        await adapter.setDocument("admin", doc);
        const authDoc = adapter.getDocument("auth");
        const acc = authDoc.accounts?.find((a) => a.id === id);
        if (acc) acc.disabled = status === "disabled";
        await adapter.setDocument("auth", authDoc);
        return doc.users[idx];
      },
      async adjustCredits(id, delta) {
        const doc = getDoc();
        const idx = doc.users.findIndex((u) => u.id === id);
        if (idx === -1) return null;
        doc.users[idx].credits = Math.max(0, (doc.users[idx].credits || 0) + Number(delta));
        await adapter.setDocument("admin", doc);
        return doc.users[idx];
      },
    };
  }

  return { create };
});
