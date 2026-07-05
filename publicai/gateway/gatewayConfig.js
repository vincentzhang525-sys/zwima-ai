(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaGatewayConfig = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MODES = ["mock", "development", "production"];
  const REQUEST_MODES = ["mock", "real"];

  function cfg() {
    return (typeof window !== "undefined" ? window.ZWIMA_CONFIG : global.ZWIMA_CONFIG) || {};
  }

  function getMode() {
    const mode = String(cfg().GATEWAY_MODE || "mock").toLowerCase();
    return MODES.includes(mode) ? mode : "mock";
  }

  function isMockMode() {
    return getMode() === "mock";
  }

  function isRealMode() {
    return getMode() === "development" || getMode() === "production";
  }

  function getApiKey(providerId) {
    const Secrets = typeof ZwimaSecrets !== "undefined" ? ZwimaSecrets : null;
    if (Secrets) return Secrets.getApiKey(providerId);
    const keys = cfg().PROVIDER_API_KEYS || {};
    if (providerId === "openai") return keys.openai || cfg().OPENAI_API_KEY || keys.default || null;
    return keys[providerId] || keys.default || null;
  }

  function resolveRequestMode(payload) {
    const explicit = String(payload?.mode || payload?.playgroundMode || "").toLowerCase();
    if (REQUEST_MODES.includes(explicit)) return explicit;
    if (explicit === "development" || explicit === "production") return "real";
    if (isMockMode()) return "mock";
    return "real";
  }

  function getHealthIntervalMs() {
    return cfg().GATEWAY_HEALTH_INTERVAL_MS || 30000;
  }

  function getPlaygroundMode() {
    return String(cfg().PLAYGROUND_MODE || "mock").toLowerCase() === "real" ? "real" : "mock";
  }

  return {
    MODES,
    REQUEST_MODES,
    getMode,
    isMockMode,
    isRealMode,
    getApiKey,
    resolveRequestMode,
    getPlaygroundMode,
    getHealthIntervalMs,
    getTimeout(mode) {
      const m = mode || getMode();
      if (m === "production" || m === "real") return cfg().GATEWAY_TIMEOUT_PRODUCTION_MS || 30000;
      if (m === "development") return cfg().GATEWAY_TIMEOUT_DEVELOPMENT_MS || 45000;
      return cfg().GATEWAY_TIMEOUT_MOCK_MS || 1200;
    },
  };
});
