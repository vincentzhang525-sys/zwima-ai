(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaStripeConfig = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MODES = ["mock", "test", "production"];

  function cfg() {
    return (typeof window !== "undefined" ? window.ZWIMA_CONFIG : global.ZWIMA_CONFIG) || {};
  }

  function getMode() {
    const mode = String(cfg().STRIPE_MODE || "mock").toLowerCase();
    return MODES.includes(mode) ? mode : "mock";
  }

  function isMockMode() {
    return getMode() === "mock";
  }

  function getSecretKey() {
    if (typeof process !== "undefined" && process.env?.STRIPE_SECRET_KEY) {
      return process.env.STRIPE_SECRET_KEY;
    }
    return cfg().STRIPE_SECRET_KEY || null;
  }

  function getPublishableKey() {
    if (typeof process !== "undefined" && process.env?.STRIPE_PUBLISHABLE_KEY) {
      return process.env.STRIPE_PUBLISHABLE_KEY;
    }
    return cfg().STRIPE_PUBLISHABLE_KEY || null;
  }

  function getWebhookSecret() {
    if (typeof process !== "undefined" && process.env?.STRIPE_WEBHOOK_SECRET) {
      return process.env.STRIPE_WEBHOOK_SECRET;
    }
    return cfg().STRIPE_WEBHOOK_SECRET || null;
  }

  function getCreditRate() {
    return cfg().CREDIT_RATE_EUR || 0.1;
  }

  function getVatRate() {
    return cfg().VAT_RATE || 0.19;
  }

  function eurToCredits(amountEur) {
    return Math.round(Number(amountEur) / getCreditRate());
  }

  function calcPricing(amountEur) {
    const price = Number(amountEur);
    const vat = price * getVatRate();
    const credits = eurToCredits(price);
    return { price, vat, total: price + vat, credits };
  }

  const PACKAGES_EUR = [10, 25, 50, 100];

  return {
    MODES,
    PACKAGES_EUR,
    getMode,
    isMockMode,
    getSecretKey,
    getPublishableKey,
    getWebhookSecret,
    getCreditRate,
    getVatRate,
    eurToCredits,
    calcPricing,
  };
});
