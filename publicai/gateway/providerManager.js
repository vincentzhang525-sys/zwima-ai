(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaProviderManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_PROVIDERS = {
    openai: { enabled: true, priority: 1, weight: 100, fallback: "anthropic", retry: 2, timeout: 30000 },
    anthropic: { enabled: true, priority: 2, weight: 90, fallback: "google", retry: 2, timeout: 30000 },
    google: { enabled: true, priority: 3, weight: 85, fallback: "openai", retry: 2, timeout: 25000 },
    deepseek: { enabled: true, priority: 4, weight: 70, fallback: "openrouter", retry: 1, timeout: 20000 },
    qwen: { enabled: true, priority: 5, weight: 65, fallback: "openrouter", retry: 1, timeout: 20000 },
    mistral: { enabled: true, priority: 6, weight: 60, fallback: "openai", retry: 1, timeout: 25000 },
    openrouter: { enabled: true, priority: 7, weight: 50, fallback: "deepseek", retry: 1, timeout: 35000 },
    openai_compatible: { enabled: true, priority: 8, weight: 40, fallback: "openai", retry: 1, timeout: 30000 },
  };

  function createProviderManager(getConfig, saveConfig) {
    function ensure() {
      let cfg = getConfig();
      if (!cfg?.providers) {
        cfg = { mode: "mock", providers: { ...DEFAULT_PROVIDERS }, health: {} };
        saveConfig(cfg);
      }
      return cfg;
    }

    return {
      getConfig() {
        return ensure();
      },
      getProvider(id) {
        return ensure().providers[id] || null;
      },
      getEnabledProviders() {
        const cfg = ensure();
        return Object.entries(cfg.providers)
          .filter(([, p]) => p.enabled)
          .sort((a, b) => a[1].priority - b[1].priority)
          .map(([id, p]) => ({ id, ...p }));
      },
      isEnabled(id) {
        return !!ensure().providers[id]?.enabled;
      },
      setEnabled(id, enabled) {
        const cfg = ensure();
        if (!cfg.providers[id]) return null;
        cfg.providers[id].enabled = !!enabled;
        saveConfig(cfg);
        return cfg.providers[id];
      },
      updateProvider(id, patch) {
        const cfg = ensure();
        if (!cfg.providers[id]) return null;
        cfg.providers[id] = { ...cfg.providers[id], ...patch };
        saveConfig(cfg);
        return cfg.providers[id];
      },
      getFallbackChain(id) {
        const chain = [];
        const seen = new Set();
        let current = id;
        while (current && !seen.has(current)) {
          seen.add(current);
          const p = ensure().providers[current];
          if (!p?.enabled) break;
          chain.push(current);
          current = p.fallback;
        }
        return chain;
      },
      getRetry(id) {
        return ensure().providers[id]?.retry ?? 1;
      },
      getTimeout(id) {
        return ensure().providers[id]?.timeout ?? 30000;
      },
      getWeight(id) {
        return ensure().providers[id]?.weight ?? 50;
      },
      getPriority(id) {
        return ensure().providers[id]?.priority ?? 99;
      },
      saveHealthSnapshot(snapshot) {
        const cfg = ensure();
        cfg.health = { ...cfg.health, ...snapshot, updatedAt: new Date().toISOString() };
        saveConfig(cfg);
        return cfg.health;
      },
      getHealthSnapshot() {
        return ensure().health || {};
      },
    };
  }

  return { createProviderManager, DEFAULT_PROVIDERS };
});
