(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAdminEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PROVIDER_IDS = ["openai", "anthropic", "deepseek", "google", "qwen"];

  function createAdminEngine(repos) {
    async function audit(actor, action, target, detail) {
      return repos.auditLog.append({ actor: actor?.email || actor, action, target, detail });
    }

    function requireAdmin(user) {
      const PM = typeof ZwimaPermissionManager !== "undefined" ? ZwimaPermissionManager : require("../auth/permissionManager");
      if (!PM.hasRole(user, "Admin")) {
        const err = new Error("Admin access required");
        err.code = 403;
        throw err;
      }
      return user;
    }

    return {
      requireAdmin,

      async getUsers(adminUser, query) {
        requireAdmin(adminUser);
        return repos.adminUsers.findAll(query);
      },

      async toggleUser(adminUser, userId, enabled) {
        requireAdmin(adminUser);
        const user = await repos.adminUsers.setStatus(userId, enabled ? "active" : "disabled");
        await audit(adminUser, enabled ? "user.enable" : "user.disable", user?.email, `Status: ${user?.status}`);
        return user;
      },

      async adjustUserCredits(adminUser, userId, delta) {
        requireAdmin(adminUser);
        const user = await repos.adminUsers.adjustCredits(userId, delta);
        await audit(adminUser, "user.credits.adjust", user?.email, `${delta >= 0 ? "+" : ""}${delta} credits`);
        return user;
      },

      async getProviders(adminUser) {
        requireAdmin(adminUser);
        const cfg = await repos.gateway.findAll();
        const health = cfg.health || {};
        return PROVIDER_IDS.map((id) => {
          const p = cfg.providers?.[id] || {};
          const h = health[id] || {};
          return {
            id,
            name: id === "google" ? "Gemini" : id.charAt(0).toUpperCase() + id.slice(1),
            enabled: p.enabled !== false,
            priority: p.priority ?? 99,
            weight: p.weight ?? 50,
            health: h.status || "unknown",
            latency: h.latency || 0,
            availability: h.availability || 0,
          };
        });
      },

      async updateProvider(adminUser, providerId, patch) {
        requireAdmin(adminUser);
        const { enabled, priority, weight, ...rest } = patch;
        const update = { ...rest };
        if (enabled !== undefined) update.enabled = !!enabled;
        if (priority !== undefined) update.priority = Number(priority);
        if (weight !== undefined) update.weight = Number(weight);
        const updated = repos.gateway.providerManager.updateProvider(providerId, update);
        await audit(adminUser, enabled === false ? "provider.disable" : "provider.update", providerId, JSON.stringify(update));
        return updated;
      },

      async getPricing(adminUser) {
        requireAdmin(adminUser);
        return repos.pricing.findAll();
      },

      async updatePricing(adminUser, id, patch) {
        requireAdmin(adminUser);
        const row = await repos.pricing.update(id, patch);
        await audit(adminUser, "pricing.update", row?.model, `Sell: ${row?.sellPrice}`);
        return row;
      },

      async getBilling(adminUser) {
        requireAdmin(adminUser);
        const [payments, invoices, transactions] = await Promise.all([
          repos.payments.getHistory(),
          repos.invoices.getList(),
          repos.transactions.getHistory(),
        ]);
        return {
          orders: payments,
          payments,
          refunds: payments.filter((p) => p.status === "refunded"),
          invoices,
          transactions,
        };
      },

      async getApiKeys(adminUser) {
        requireAdmin(adminUser);
        return repos.apiKeys.getKeys();
      },

      async createApiKey(adminUser, payload) {
        requireAdmin(adminUser);
        const record = {
          id: `key-${Date.now()}`,
          name: payload.name || "Admin Key",
          prefix: `zwima_live_${Date.now().toString(36).slice(0, 10)}`,
          provider: payload.provider || "OpenAI",
          environment: payload.environment || "Production",
          scopes: payload.scopes || ["Read", "Write"],
          expiration: payload.expiration || "Never",
          created: new Date().toISOString().slice(0, 10),
          lastUsed: "Never",
          status: "Active",
          quota: payload.quota || "50,000 / mo",
          usage: "0",
        };
        await repos.apiKeys.createKey(record);
        await audit(adminUser, "apikey.create", record.name, record.prefix);
        return record;
      },

      async toggleApiKey(adminUser, keyId, enabled) {
        requireAdmin(adminUser);
        const key = await repos.apiKeys.updateKey(keyId, { status: enabled ? "Active" : "Disabled" });
        await audit(adminUser, enabled ? "apikey.enable" : "apikey.disable", keyId, key?.name);
        return key;
      },

      async deleteApiKey(adminUser, keyId) {
        requireAdmin(adminUser);
        await repos.apiKeys.deleteKey(keyId);
        await audit(adminUser, "apikey.delete", keyId, "Deleted");
        return { deleted: true, id: keyId };
      },

      async setApiKeyQuota(adminUser, keyId, quota) {
        requireAdmin(adminUser);
        const key = await repos.apiKeys.updateKey(keyId, { quota });
        await audit(adminUser, "apikey.quota", keyId, quota);
        return key;
      },

      async getStatistics(adminUser) {
        requireAdmin(adminUser);
        return repos.adminStats.getStatistics();
      },

      async getAuditLog(adminUser) {
        requireAdmin(adminUser);
        return repos.auditLog.findAll();
      },
    };
  }

  return { createAdminEngine, PROVIDER_IDS };
});
