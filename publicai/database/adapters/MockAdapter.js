(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ZwimaMockAdapter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SEED_KEY = "zwima_db_seeded_v1";
  const STORE_KEY = "zwima_db_store_v1";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function delay() {
    const cfg = typeof window !== "undefined" ? window.ZWIMA_CONFIG || {} : {};
    const min = cfg.MOCK_DELAY_MIN_MS || 300;
    const max = cfg.MOCK_DELAY_MAX_MS || 800;
    const ms = Math.floor(min + Math.random() * (max - min + 1));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function createMockAdapter(options) {
    const opts = options || {};
    const errorRate = opts.errorRate ?? (typeof window !== "undefined" ? window.ZWIMA_CONFIG?.MOCK_ERROR_RATE : 0.02) ?? 0.02;
    const fs = opts.fs || null;
    const path = opts.path || null;
    const mockDir = opts.mockDir || "mock";
    const seedData = opts.seedData || (typeof ZwimaSeedData !== "undefined" ? ZwimaSeedData : require("../seed"));

    function maybeError() {
      if (Math.random() < errorRate) {
        const err = new Error("Simulated database error (503)");
        err.code = 503;
        throw err;
      }
    }

    let store = {
      providers: {},
      models: { marketplace: [], catalog: [] },
      apikeys: { keys: [], activity: [] },
      users: {},
      auth: { accounts: [], sessions: [], resetTokens: [] },
      billing: {},
      credits: {},
      routing: {},
      logs: {},
      settings: {},
      gateway: {},
      payments: { payments: [] },
      invoices: { invoices: [] },
      admin: {},
    };

    let initialized = false;
    let session = null;

    function persist() {
      if (typeof window !== "undefined" && window.ZwimaStorage) {
        window.ZwimaStorage.setRaw("DB_STORE", JSON.stringify(store));
        window.ZwimaStorage.setRaw(SEED_KEY, "1");
      }
    }

    function loadPersisted() {
      if (typeof window !== "undefined" && window.ZwimaStorage) {
        const raw = window.ZwimaStorage.getRaw("DB_STORE");
        if (raw) {
          try {
            store = JSON.parse(raw);
            return true;
          } catch {
            return false;
          }
        }
      }
      return false;
    }

    async function loadJsonFile(name) {
      if (fs && path) {
        const filePath = path.join(mockDir, name);
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      }
      const res = await fetch(`${mockDir}/${name}`);
      if (!res.ok) throw new Error(`Failed to load ${name}`);
      return res.json();
    }

    function buildMarketplace(providers) {
      const list = Object.values(providers);
      return list.map((provider) => ({
        ...provider,
        tags: [...new Set(provider.models.flatMap((m) => m.tags))].slice(0, 3),
        firstModelSlug: provider.models[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      }));
    }

    function buildCatalog(providers) {
      return Object.values(providers).flatMap((p) =>
        p.models.map((m) => ({ providerId: p.id, providerName: p.name, ...m }))
      );
    }

    async function seedFromFiles() {
      const [providers, apikeys, users, auth, billing, credits, routing, logs, settings, gateway, payments, invoices, admin] = await Promise.all([
        loadJsonFile("providers.json"),
        loadJsonFile("apikeys.json"),
        loadJsonFile("users.json"),
        loadJsonFile("auth.json"),
        loadJsonFile("billing.json"),
        loadJsonFile("credits.json"),
        loadJsonFile("routing.json"),
        loadJsonFile("logs.json"),
        loadJsonFile("settings.json"),
        loadJsonFile("gateway.json"),
        loadJsonFile("payments.json"),
        loadJsonFile("invoices.json"),
        loadJsonFile("admin.json"),
      ]);

      store.providers = providers;
      store.models = { marketplace: buildMarketplace(providers), catalog: buildCatalog(providers) };
      store.apikeys = apikeys;
      store.users = { ...users, id: users.id || "user-demo-1" };
      store.auth = auth;
      store.billing = { ...billing, id: billing.id || "billing-1" };
      store.credits = { ...credits, id: credits.id || "credits-1" };
      store.routing = { ...routing, id: routing.id || "routing-1" };
      store.logs = { ...logs, id: logs.id || "logs-1" };
      store.settings = { ...settings, id: settings.id || "settings-1" };
      store.gateway = gateway;
      store.payments = payments;
      store.invoices = invoices;
      store.admin = admin;
    }

    function seedFromDefaults() {
      const seed = seedData;
      store.providers = clone(seed.providers || {});
      store.models = clone(seed.models || { marketplace: [], catalog: [] });
      store.apikeys = clone(seed.apikeys);
      store.users = clone(seed.user);
      store.auth = clone(seed.auth || { accounts: [], sessions: [], resetTokens: [] });
      store.billing = clone(seed.billing);
      store.credits = clone(seed.credits);
      store.routing = clone(seed.routing);
      store.logs = clone(seed.logs);
      store.settings = clone(seed.settings);
      store.gateway = clone(seed.gateway || { mode: "mock", providers: {}, health: {} });
      store.payments = clone(seed.payments || { payments: [] });
      store.invoices = clone(seed.invoices || { invoices: [] });
      store.admin = clone(seed.admin || { users: [], pricing: [], statistics: {}, auditLog: [] });
    }

    async function init() {
      if (initialized) return store;
      if (loadPersisted()) {
        initialized = true;
        return store;
      }

      try {
        await seedFromFiles();
      } catch {
        seedFromDefaults();
        if (!store.providers || !Object.keys(store.providers).length) {
          const providers = await loadJsonFile("providers.json").catch(() => null);
          if (providers) {
            store.providers = providers;
            store.models = { marketplace: buildMarketplace(providers), catalog: buildCatalog(providers) };
          }
        }
      }

      initialized = true;
      persist();
      return store;
    }

    function wrap(op) {
      return delay().then(() => {
        maybeError();
        return op();
      });
    }

    function countRecords() {
      let total = 0;
      total += Object.keys(store.providers || {}).length;
      total += (store.models?.catalog || []).length;
      total += (store.apikeys?.keys || []).length;
      total += (store.apikeys?.activity || []).length;
      total += store.users ? 1 : 0;
      total += (store.auth?.accounts || []).length;
      total += (store.auth?.sessions || []).length;
      total += (store.billing?.transactions || []).length;
      total += (store.routing?.routingLog || []).length;
      total += (store.logs?.requestLogs || []).length;
      return total;
    }

    return {
      driver: "MockAdapter",
      database: "ZWIMA Mock Store",
      async init() {
        return init();
      },
      async ping() {
        const start = Date.now();
        await delay();
        return { latency: Date.now() - start, status: "Operational" };
      },
      async getHealth() {
        const ping = await this.ping();
        return {
          database: this.database,
          driver: this.driver,
          status: ping.status,
          latency: `${ping.latency} ms`,
          records: countRecords(),
        };
      },
      getDocument(table) {
        return clone(store[table]);
      },
      setDocument(table, doc) {
        store[table] = clone(doc);
        persist();
        return store[table];
      },
      findAll(table) {
        return wrap(() => clone(store[table]));
      },
      findById(table, id, idField) {
        return wrap(() => {
          const doc = store[table];
          if (table === "providers") return clone(doc[id] || doc.openai);
          if (table === "users" || table === "billing" || table === "credits" || table === "routing" || table === "logs" || table === "settings") {
            return doc[idField || "id"] === id ? clone(doc) : clone(doc);
          }
          if (Array.isArray(doc)) return clone(doc.find((item) => item[idField || "id"] === id) || null);
          if (doc.keys) return clone(doc.keys.find((item) => item.id === id) || null);
          if (doc.activity) return clone(doc.activity.find((item) => item.id === id) || null);
          return null;
        });
      },
      create(table, data, options) {
        return wrap(() => {
          const idField = options?.idField || "id";
          const record = { ...data, [idField]: data[idField] || `${table}-${Date.now()}` };

          if (table === "providers") {
            store.providers[record.id] = record;
          } else if (table === "apikeys") {
            store.apikeys.keys.unshift(record);
          } else if (Array.isArray(store[table])) {
            store[table].unshift(record);
          } else if (store[table]?.keys) {
            store[table].keys.unshift(record);
          } else if (store[table]?.routingLog) {
            store[table].routingLog.unshift(record);
          }

          persist();
          return clone(record);
        });
      },
      update(table, id, data, options) {
        return wrap(() => {
          const idField = options?.idField || "id";
          if (table === "providers" && store.providers[id]) {
            store.providers[id] = { ...store.providers[id], ...data };
            persist();
            return clone(store.providers[id]);
          }
          if (table === "apikeys") {
            const idx = store.apikeys.keys.findIndex((k) => k.id === id);
            if (idx === -1) return null;
            store.apikeys.keys[idx] = { ...store.apikeys.keys[idx], ...data };
            persist();
            return clone(store.apikeys.keys[idx]);
          }
          if (store[table] && !Array.isArray(store[table])) {
            store[table] = { ...store[table], ...data };
            persist();
            return clone(store[table]);
          }
          return null;
        });
      },
      delete(table, id, options) {
        return wrap(() => {
          if (table === "apikeys") {
            const before = store.apikeys.keys.length;
            store.apikeys.keys = store.apikeys.keys.filter((k) => k.id !== id);
            persist();
            return store.apikeys.keys.length < before;
          }
          if (table === "providers" && store.providers[id]) {
            delete store.providers[id];
            persist();
            return true;
          }
          return false;
        });
      },
      getSession() {
        return session;
      },
      setSession(user) {
        session = user;
        if (user) store.users = { ...store.users, ...user };
        persist();
        return session;
      },
      clearSession() {
        session = null;
        return null;
      },
      countRecords,
      _getStore() {
        return store;
      },
    };
  }

  return { createMockAdapter };
});
