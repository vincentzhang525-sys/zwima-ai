(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaEnvLoader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function parseDotEnv(content) {
    const vars = {};
    String(content || "")
      .split(/\r?\n/)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const idx = trimmed.indexOf("=");
        if (idx === -1) return;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key] = value;
      });
    return vars;
  }

  function loadDotEnv(filePath, fs) {
    if (!fs || !filePath) return {};
    try {
      if (!fs.existsSync(filePath)) return {};
      return parseDotEnv(fs.readFileSync(filePath, "utf8"));
    } catch {
      return {};
    }
  }

  function applyToProcess(vars) {
    if (typeof process === "undefined" || !process.env) return vars;
    Object.entries(vars).forEach(([key, value]) => {
      if (value && !process.env[key]) process.env[key] = value;
    });
    return vars;
  }

  function loadIntoGlobalConfig(vars, globalConfig) {
    const target = globalConfig || global.ZWIMA_CONFIG || {};
    if (vars.OPENAI_API_KEY) {
      target.OPENAI_API_KEY = vars.OPENAI_API_KEY;
      target.PROVIDER_API_KEYS = { ...(target.PROVIDER_API_KEYS || {}), openai: vars.OPENAI_API_KEY };
    }
    if (vars.STRIPE_SECRET_KEY) target.STRIPE_SECRET_KEY = vars.STRIPE_SECRET_KEY;
    if (vars.STRIPE_PUBLISHABLE_KEY) target.STRIPE_PUBLISHABLE_KEY = vars.STRIPE_PUBLISHABLE_KEY;
    if (vars.STRIPE_WEBHOOK_SECRET) target.STRIPE_WEBHOOK_SECRET = vars.STRIPE_WEBHOOK_SECRET;
    if (vars.STRIPE_MODE) target.STRIPE_MODE = vars.STRIPE_MODE;
    if (vars.GATEWAY_MODE) target.GATEWAY_MODE = vars.GATEWAY_MODE;
    global.ZWIMA_CONFIG = target;
    return target;
  }

  return { parseDotEnv, loadDotEnv, applyToProcess, loadIntoGlobalConfig };
});
