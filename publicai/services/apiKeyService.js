(function () {
  const KEY_PREFIX = "zw_live_";
  const RANDOM_LENGTH = 32;
  const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

  function storageKey() {
    const email = window.ZwimaAuthService?.getCurrentUser()?.email;
    if (!email) return null;
    return `zwima_api_keys_${email}`;
  }

  function generateSecret() {
    let secret = "";
    for (let i = 0; i < RANDOM_LENGTH; i += 1) {
      secret += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return `${KEY_PREFIX}${secret}`;
  }

  function loadStore() {
    const key = storageKey();
    if (!key) return { keys: [] };
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { keys: [] };
      const parsed = JSON.parse(raw);
      return {
        keys: Array.isArray(parsed.keys) ? parsed.keys : [],
      };
    } catch {
      return { keys: [] };
    }
  }

  function saveStore(store) {
    const key = storageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(store));
    syncSessionCount(store.keys);
  }

  function syncSessionCount(keys) {
    const activeCount = keys.filter((item) => item.status === "Active").length;
    const user = window.ZwimaAuthService?.getCurrentUser?.();
    if (!user || !window.ZwimaStorage) return;
    window.ZwimaStorage.set("SESSION", {
      ...user,
      apiKeyCount: activeCount,
    });
  }

  function newId() {
    return `key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function findKey(store, id) {
    return store.keys.find((item) => item.id === id);
  }

  function setStatus(id, status) {
    const store = loadStore();
    const key = findKey(store, id);
    if (!key) throw new Error("API key not found.");
    key.status = status;
    saveStore(store);
    return key;
  }

  function isSupabase() {
    return window.ZwimaDbMode?.isSupabaseMode?.();
  }

  function getKeysFromCache() {
    if (isSupabase()) return window.ZwimaSupabaseApiKeys?.getCachedKeys?.() || [];
    return loadStore().keys;
  }

  window.ZwimaApiKeyService = {
    KEY_PREFIX,

    async refreshKeys() {
      if (isSupabase()) return window.ZwimaSupabaseApiKeys.refreshFromDb();
      return loadStore().keys;
    },

    getKeys() {
      return getKeysFromCache().slice().reverse();
    },

    getActiveCount() {
      return getKeysFromCache().filter((item) => item.status === "Active").length;
    },

    createKey(name) {
      if (isSupabase()) return window.ZwimaSupabaseApiKeys.createKey(name);
      const trimmed = String(name || "").trim();
      if (!trimmed) throw new Error("Key name is required.");
      const store = loadStore();
      const record = {
        id: newId(),
        name: trimmed,
        key: generateSecret(),
        createdAt: today(),
        lastUsed: "Never",
        totalUsage: 0,
        status: "Active",
      };
      store.keys.push(record);
      saveStore(store);
      return record;
    },

    deleteKey(id) {
      if (isSupabase()) return window.ZwimaSupabaseApiKeys.deleteKey(id);
      const store = loadStore();
      const before = store.keys.length;
      store.keys = store.keys.filter((item) => item.id !== id);
      if (store.keys.length === before) throw new Error("API key not found.");
      saveStore(store);
      return true;
    },

    disableKey(id) {
      if (isSupabase()) return window.ZwimaSupabaseApiKeys.setStatus(id, "Disabled");
      return setStatus(id, "Disabled");
    },

    enableKey(id) {
      if (isSupabase()) return window.ZwimaSupabaseApiKeys.setStatus(id, "Active");
      return setStatus(id, "Active");
    },

    renameKey(id, name) {
      if (isSupabase()) return window.ZwimaSupabaseApiKeys.renameKey(id, name);
      const trimmed = String(name || "").trim();
      if (!trimmed) throw new Error("Key name is required.");
      const store = loadStore();
      const key = findKey(store, id);
      if (!key) throw new Error("API key not found.");
      key.name = trimmed;
      saveStore(store);
      return key;
    },
  };
})();
