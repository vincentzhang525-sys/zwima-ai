(function () {
  let recordsCache = [];

  async function refreshFromDb(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== "") params.set(k, String(v));
    });
    const data = await window.ZwimaSupabaseApi.apiFetch(`/api/usage${params.toString() ? `?${params}` : ""}`);
    recordsCache = data.records || [];
    return recordsCache;
  }

  window.ZwimaSupabaseUsage = {
    refreshFromDb,
    getCachedRecords() {
      return recordsCache;
    },
    async addRecord(payload) {
      const data = await window.ZwimaSupabaseApi.apiFetch("/api/usage", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      recordsCache.unshift(data.record);
      window.ZwimaAppEvents?.emit?.("data-updated", { source: "usage" });
      return data.record;
    },
  };
})();
