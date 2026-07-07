(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaSecrets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function cfg() {
    return (typeof window !== "undefined" ? window.ZWIMA_CONFIG : global.ZWIMA_CONFIG) || {};
  }

  function fromEnv() {
    if (typeof process === "undefined" || !process.env) return {};
    return {
      openai: process.env.OPENAI_API_KEY || null,
      default: process.env.ZWIMA_API_KEY || null,
    };
  }

  function fromConfig() {
    // Never expose raw secret keys to browser runtime config.
    return {
      openai: null,
      default: null,
    };
  }

  function getApiKey(providerId) {
    const env = fromEnv();
    const conf = fromConfig();
    if (providerId === "openai") return env.openai || conf.openai || conf.default || null;
    return conf[providerId] || env[providerId] || conf.default || env.default || null;
  }

  function hasOpenAIKey() {
    return !!getApiKey("openai");
  }

  return { getApiKey, hasOpenAIKey, fromEnv, fromConfig };
});
