(function () {
  const COST_PER_TOKEN_EUR = 0.000002;

  function storageKey() {
    const email = window.ZwimaAuthService?.getCurrentUser()?.email;
    if (!email) return null;
    return `zwima_usage_history_${email}`;
  }

  function loadStore() {
    const key = storageKey();
    if (!key) return { records: [] };
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { records: [] };
      const parsed = JSON.parse(raw);
      return {
        records: Array.isArray(parsed.records) ? parsed.records : [],
      };
    } catch {
      return { records: [] };
    }
  }

  function saveStore(store) {
    const key = storageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(store));
  }

  function newId() {
    return `usage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function estimateCost(totalTokens) {
    const tokens = Number(totalTokens) || 0;
    return Number((tokens * COST_PER_TOKEN_EUR).toFixed(6));
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isSupabase() {
    return window.ZwimaDbMode?.isSupabaseMode?.();
  }

  function getRecordsFromCache() {
    if (isSupabase()) return window.ZwimaSupabaseUsage?.getCachedRecords?.() || [];
    return loadStore().records;
  }

  window.ZwimaUsageService = {
    estimateCost,

    async refreshRecords() {
      if (isSupabase()) return window.ZwimaSupabaseUsage.refreshFromDb();
      return loadStore().records;
    },

    addRecord(payload) {
      if (isSupabase()) return window.ZwimaSupabaseUsage.addRecord(payload);
      const inputTokens = Number(payload.inputTokens) || 0;
      const outputTokens = Number(payload.outputTokens) || 0;
      const totalTokens = Number(payload.totalTokens) || inputTokens + outputTokens;
      const record = {
        id: newId(),
        dateTime: payload.dateTime || new Date().toISOString(),
        provider: payload.provider || "—",
        model: payload.model || "—",
        prompt: payload.prompt || "",
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: payload.estimatedCost ?? estimateCost(totalTokens),
        creditsDeducted: Number(payload.creditsDeducted) || 0,
        requestTimeMs: Number(payload.requestTimeMs) || 0,
        remainingCredits: Number(payload.remainingCredits) || 0,
        status: payload.status || "Success",
      };
      const store = loadStore();
      store.records.unshift(record);
      saveStore(store);
      return record;
    },

    getRecords(filters = {}) {
      let rows = getRecordsFromCache().slice();
      const provider = filters.provider || "";
      const model = filters.model || "";

      if (provider) rows = rows.filter((row) => row.provider === provider);
      if (model) rows = rows.filter((row) => row.model === model);

      rows.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
      return rows;
    },

    getRecentActivity(limit = 4) {
      return getRecordsFromCache()
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
        .slice(0, limit)
        .map((row) => ({
          type: "API Call",
          detail: `${row.provider} · ${row.model} — ${truncate(row.prompt, 64)}`,
          time: formatDateTime(row.dateTime),
        }));
    },

    getFilterOptions() {
      const records = getRecordsFromCache();
      return {
        providers: [...new Set(records.map((row) => row.provider).filter(Boolean))].sort(),
        models: [...new Set(records.map((row) => row.model).filter(Boolean))].sort(),
      };
    },
  };

  function truncate(text, len) {
    const value = String(text || "");
    return value.length <= len ? value : `${value.slice(0, len)}…`;
  }
})();
