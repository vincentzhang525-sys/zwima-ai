const {
  getStripeMode,
  stripeKeysPresent,
  stripeWebhookConfigured,
  paymentMustFailClosed,
  allowsMockPaymentFallback,
} = require("../commercial/environment");

function getStripeConfig() {
  const mode = getStripeMode();
  return {
    mode: allowsMockPaymentFallback() ? "mock" : mode,
    secretKey: process.env.STRIPE_SECRET_KEY || null,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
    keysPresent: stripeKeysPresent(),
    webhookConfigured: stripeWebhookConfigured(),
    failClosed: paymentMustFailClosed() && !allowsMockPaymentFallback(),
    allowsMockFallback: allowsMockPaymentFallback(),
  };
}

function assertStripeOperational() {
  const cfg = getStripeConfig();
  if (cfg.mode === "mock" || cfg.allowsMockFallback) return cfg;
  if (cfg.failClosed) {
    const err = new Error(
      `Stripe ${getStripeMode()} mode misconfigured. Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET.`
    );
    err.code = "STRIPE_MISCONFIGURED";
    throw err;
  }
  return cfg;
}

function isRealStripeMode() {
  const mode = getStripeMode();
  return (mode === "test" || mode === "live") && stripeKeysPresent() && !allowsMockPaymentFallback();
}

module.exports = {
  getStripeConfig,
  assertStripeOperational,
  isRealStripeMode,
  getStripeMode,
};
