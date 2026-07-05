(function () {
  async function getDb() {
    await window.ZwimaDatabase.init();
    return window.ZwimaDatabase.getRepositories();
  }

  let cachedMap = null;
  let cachedList = null;

  async function loadProviders() {
    if (cachedMap) return { map: cachedMap, list: cachedList };
    const data = await (await getDb()).providers.findAll();
    cachedMap = data.map;
    cachedList = data.list;
    return { map: cachedMap, list: cachedList };
  }

  window.ZwimaProviderService = {
    async getProviderMap() {
      const { map } = await loadProviders();
      return map;
    },
    async getProviderList() {
      const { list } = await loadProviders();
      return list;
    },
    async getProviderById(id) {
      return (await getDb()).providers.findById(id);
    },
    async getProviderFromQuery() {
      const params = new URLSearchParams(window.location.search);
      const id = (params.get("provider") || "openai").toLowerCase();
      return this.getProviderById(id);
    },
    async getMarketplaceProviders() {
      return (await getDb()).models.getMarketplace();
    },
    slugify(name) {
      return window.ZwimaFormat.slugify(name);
    },
    generateApiKeyPrefix() {
      return window.ZwimaFormat.generateApiKeyPrefix();
    },
  };
})();
