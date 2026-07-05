(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaBaseRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function BaseRepository(adapter, table, options) {
    const opts = options || {};
    const idField = opts.idField || "id";
    const isArray = opts.isArray !== false;

    return {
      table,
      findAll(filter) {
        return adapter.findAll(table, filter);
      },
      findById(id) {
        return adapter.findById(table, id, idField);
      },
      create(data) {
        return adapter.create(table, data, { idField, isArray });
      },
      update(id, data) {
        return adapter.update(table, id, data, { idField, isArray });
      },
      delete(id) {
        return adapter.delete(table, id, { idField, isArray });
      },
      getDocument() {
        return adapter.getDocument(table);
      },
      setDocument(doc) {
        return adapter.setDocument(table, doc);
      },
    };
  }

  return { BaseRepository };
});
