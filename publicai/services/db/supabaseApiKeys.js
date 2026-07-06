(function () {
  let keysCache = [];

  async function refreshFromDb() {
    const data = await window.ZwimaSupabaseApi.apiFetch("/api/apikeys");
    keysCache = data.keys || [];
    syncSessionCount(keysCache);
    return keysCache;
  }

  function syncSessionCount(keys) {
    const activeCount = keys.filter((item) => item.status === "Active").length;
    const user = window.ZwimaAuthService?.getCurrentUser?.();
    if (!user || !window.ZwimaStorage) return;
    window.ZwimaStorage.set("SESSION", { ...user, apiKeyCount: activeCount });
  }

  window.ZwimaSupabaseApiKeys = {
    async refreshFromDb,
    getCachedKeys() {
      return keysCache;
    },
    async createKey(name) {
      const data = await window.ZwimaSupabaseApi.apiFetch("/api/apikeys", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      keysCache.unshift(data.key);
      syncSessionCount(keysCache);
      return data.key;
    },
    async deleteKey(id) {
      await window.ZwimaSupabaseApi.apiFetch("/api/apikeys", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      keysCache = keysCache.filter((item) => item.id !== id);
      syncSessionCount(keysCache);
      return true;
    },
    async setStatus(id, status) {
      const data = await window.ZwimaSupabaseApi.apiFetch("/api/apikeys", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      keysCache = keysCache.map((item) => (item.id === id ? data.key : item));
      syncSessionCount(keysCache);
      return data.key;
    },
    async renameKey(id, name) {
      const data = await window.ZwimaSupabaseApi.apiFetch("/api/apikeys", {
        method: "PATCH",
        body: JSON.stringify({ id, name }),
      });
      keysCache = keysCache.map((item) => (item.id === id ? data.key : item));
      return data.key;
    },
  };
})();
