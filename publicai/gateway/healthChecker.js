(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaHealthChecker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const HEALTH = {
    ONLINE: "online",
    OFFLINE: "offline",
    NOT_CONFIGURED: "not_configured",
    API_ERROR: "api_error",
    AUTHENTICATION_ERROR: "authentication_error",
    RATE_LIMITED: "rate_limited",
  };

  function normalize(raw, configured) {
    if (!configured) return HEALTH.NOT_CONFIGURED;
    const status = String(raw?.status || raw?.healthStatus || "").toLowerCase();
    const code = Number(raw?.code || raw?.httpStatus || 0);
    if (status === "healthy" || status === "online") return HEALTH.ONLINE;
    if (status === "unconfigured" || status === "not_configured") return HEALTH.NOT_CONFIGURED;
    if (code === 401 || code === 403 || status === "authentication_error") return HEALTH.AUTHENTICATION_ERROR;
    if (code === 429 || status === "rate_limited") return HEALTH.RATE_LIMITED;
    if (status === "unhealthy" || status === "offline" || status === "degraded") return HEALTH.OFFLINE;
    if (code >= 500 || status === "api_error") return HEALTH.API_ERROR;
    if (raw?.error) return HEALTH.API_ERROR;
    return configured ? HEALTH.OFFLINE : HEALTH.NOT_CONFIGURED;
  }

  function label(status) {
    const map = {
      [HEALTH.ONLINE]: "Online",
      [HEALTH.OFFLINE]: "Offline",
      [HEALTH.NOT_CONFIGURED]: "Not Configured",
      [HEALTH.API_ERROR]: "API Error",
      [HEALTH.AUTHENTICATION_ERROR]: "Authentication Error",
      [HEALTH.RATE_LIMITED]: "Rate Limited",
    };
    return map[status] || status;
  }

  async function checkProvider(adapter, configured) {
    const started = Date.now();
    if (!adapter) {
      return { healthStatus: HEALTH.OFFLINE, latencyMs: 0, availability: 0, configured: !!configured };
    }
    if (!configured) {
      return { healthStatus: HEALTH.NOT_CONFIGURED, latencyMs: 0, availability: 0, configured: false };
    }
    try {
      const result = await adapter.health();
      const latencyMs = Number(result.latency ?? result.latencyMs ?? Date.now() - started);
      const healthStatus = normalize({ ...result, code: result.code }, true);
      return {
        healthStatus,
        latencyMs,
        availability: Number(result.availability) || (healthStatus === HEALTH.ONLINE ? 99.9 : 0),
        configured: true,
        raw: result,
      };
    } catch (err) {
      const code = Number(err.code || err.status || 0);
      return {
        healthStatus: normalize({ status: err.message, code }, true),
        latencyMs: Date.now() - started,
        availability: 0,
        configured: true,
        error: err.message,
      };
    }
  }

  return { HEALTH, normalize, label, checkProvider };
});
