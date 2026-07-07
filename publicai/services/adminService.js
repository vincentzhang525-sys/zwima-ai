(function () {
  function query(path, method, body) {
    return window.ZwimaDatabase.queryApi(path, method, body).then((r) => r.data);
  }

  window.ZwimaAdminService = {
    getUsers(q) {
      const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
      return query(`/api/admin/users${suffix}`, "GET");
    },
    toggleUser(userId, enabled) {
      return query("/api/admin/users-toggle", "POST", { userId, enabled });
    },
    adjustCredits(userId, delta) {
      return query("/api/admin/users-credits", "POST", { userId, delta });
    },
    getProviders() {
      return query("/api/admin/providers", "GET");
    },
    updateProvider(providerId, patch) {
      return query("/api/admin/providers-update", "POST", { providerId, ...patch });
    },
    getPricing() {
      return query("/api/admin/pricing", "GET");
    },
    updatePricing(id, patch) {
      return query("/api/admin/pricing", "POST", { id, ...patch });
    },
    getBilling() {
      return query("/api/admin/billing", "GET");
    },
    getCommerce() {
      return query("/api/admin/commerce", "GET");
    },
    getApiKeys() {
      return query("/api/admin/apikeys", "GET");
    },
    createApiKey(payload) {
      return query("/api/admin/apikeys?action=create", "POST", payload);
    },
    toggleApiKey(keyId, enabled) {
      return query("/api/admin/apikeys?action=toggle", "POST", { keyId, enabled });
    },
    deleteApiKey(keyId) {
      return query("/api/admin/apikeys?action=delete", "POST", { keyId });
    },
    setApiKeyQuota(keyId, quota) {
      return query("/api/admin/apikeys?action=quota", "POST", { keyId, quota });
    },
    getStatistics() {
      return query("/api/admin/statistics", "GET");
    },
    getAuditLog() {
      return query("/api/admin/audit", "GET");
    },
    getSecurityDashboard() {
      return query("/api/admin/security", "GET");
    },
    getExecutive() {
      return query("/api/admin/executive", "GET");
    },
    getRevenue() {
      return query("/api/admin/revenue", "GET");
    },
    getHealth() {
      return query("/api/admin/health", "GET");
    },
    getLogs(params = {}) {
      const qp = new URLSearchParams(params);
      return query(`/api/admin/logs${qp.toString() ? `?${qp}` : ""}`, "GET");
    },
    getUserDetails(userId) {
      return query(`/api/admin/user-details?userId=${encodeURIComponent(userId)}`, "GET");
    },
  };
})();
