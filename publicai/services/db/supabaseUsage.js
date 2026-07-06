(function () {
  let recordsCache = [];

  async function refreshFromDb() {
    const data = await window.ZwimaSupabaseApi.apiFetch("/api/usage");
    recordsCache = data.records || [];
    return recordsCache;
  }

  window.ZwimaSupabaseUsage = {
    async refreshFromDb,
    getCachedRecords() {
      return recordsCache;
    },
    async addRecord(payload) {
      const data = await window.ZwimaSupabaseApi.apiFetch("/api/usage", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      recordsCache.unshift(data.record);
      return data.record;
    },
  };
})();
