const PaymentProvider = require("./PaymentProvider");
const { stripeRequest } = require("./stripeClient");
const { assertStripeOperational, isRealStripeMode, getStripeMode } = require("./stripeConfig");
const { isProductionRuntime, isLocalRuntime } = require("../commercial/environment");

class StripePaymentProvider extends PaymentProvider {
  constructor() {
    super("stripe");
  }

  mode() {
    return getStripeMode();
  }

  async createCheckout({ userId, plan, amountEur, orderId, email, successUrl, cancelUrl, credits, metadata = {} }) {
    assertStripeOperational();

    if (!isRealStripeMode()) {
      if (isProductionRuntime()) {
        const err = new Error("Stripe is not configured for production. Set STRIPE_MODE=test|live and all Stripe keys.");
        err.code = "STRIPE_MISCONFIGURED";
        err.status = 503;
        throw err;
      }
      if (isLocalRuntime()) {
        const err = new Error("Mock Stripe checkout is disabled. Configure STRIPE_MODE=test with test keys for local development.");
        err.code = "STRIPE_MOCK_DISABLED";
        err.status = 503;
        throw err;
      }
      const err = new Error("Stripe checkout unavailable in this environment.");
      err.status = 503;
      throw err;
    }

    const host = process.env.PLATFORM_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://zwima-group.info");
    const session = await stripeRequest("/checkout/sessions", "POST", {
      mode: "payment",
      success_url: successUrl || `${host}/billing.html?payment=success&order=${orderId || ""}`,
      cancel_url: cancelUrl || `${host}/billing.html?payment=cancelled`,
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": Math.round(Number(amountEur) * 100),
      "line_items[0][price_data][product_data][name]": plan ? `ZWIMA ${plan} plan` : "ZWIMA Credits",
      "line_items[0][quantity]": 1,
      customer_email: email || undefined,
      "metadata[userId]": userId,
      "metadata[orderId]": orderId,
      "metadata[credits]": String(credits || 0),
      "metadata[plan]": plan || "",
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, String(v)])),
    });

    return {
      provider: this.name,
      status: "pending",
      mode: this.mode(),
      amountEur,
      checkoutId: session.id,
      sessionId: session.id,
      checkoutUrl: session.url,
      customerId: session.customer || null,
      subscriptionId: session.subscription || null,
      invoiceUrl: session.url,
      credits,
    };
  }

  async handleWebhook(rawBody, signatureHeader) {
    const { verifyWebhookSignature } = require("./stripeClient");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      const err = new Error("STRIPE_WEBHOOK_SECRET not configured");
      err.code = "STRIPE_MISCONFIGURED";
      throw err;
    }
    if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
      const err = new Error("Invalid Stripe webhook signature");
      err.code = "STRIPE_SIGNATURE_INVALID";
      err.status = 400;
      throw err;
    }
    return JSON.parse(rawBody);
  }

  async retrieveSession(sessionId) {
    if (!isRealStripeMode()) return null;
    return stripeRequest(`/checkout/sessions/${sessionId}`, "GET");
  }

  async createRefund({ paymentIntentId, amountEur }) {
    if (!isRealStripeMode()) {
      const err = new Error("Refunds require configured Stripe mode.");
      err.status = 503;
      throw err;
    }
    const payload = { payment_intent: paymentIntentId };
    if (amountEur) payload.amount = Math.round(Number(amountEur) * 100);
    return stripeRequest("/refunds", "POST", payload);
  }

  async cancelSubscription({ subscriptionId }) {
    if (!isRealStripeMode()) {
      const err = new Error("Subscription cancel requires configured Stripe mode.");
      err.status = 503;
      throw err;
    }
    return stripeRequest(`/subscriptions/${subscriptionId}`, "DELETE");
  }
}

module.exports = StripePaymentProvider;
