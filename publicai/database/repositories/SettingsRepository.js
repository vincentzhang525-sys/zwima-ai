(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaSettingsRepository = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const Base = typeof ZwimaBaseRepository !== "undefined" ? ZwimaBaseRepository : require("./BaseRepository");

  function create(adapter) {
    const base = Base.BaseRepository(adapter, "settings", { isArray: false, idField: "id" });

    return {
      ...base,
      findAll() {
        return adapter.findAll("settings");
      },
      getGatewayEndpoint() {
        return this.findAll().then((data) => data.gatewayEndpoint);
      },
      getProviderOptions() {
        return this.findAll().then((data) => data.providerOptions || []);
      },
      getTopUpOptions() {
        return this.findAll().then((data) => data.topUpOptions || []);
      },
      findById() {
        return this.findAll();
      },
    };
  }

  return { create };
});
