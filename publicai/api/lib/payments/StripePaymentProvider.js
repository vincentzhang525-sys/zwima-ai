const PaymentProvider = require("./PaymentProvider");
const { stripeRequest } = require("./stripeClient");
const { assertStripeOperational, isRealStripeMode, getStripeMode } = require("./stripeConfig");
const { paymentMustFailClosed } = require("../commercial/environment");

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
      const ts = Date.now();
      return {
        provider: this.name,
        status: "completed",
        mode: "mock",
        amountEur,
        checkoutId: `stripe_checkout_${ts}`,
        sessionId: `cs_mock_${ts}`,
        customerId: `cus_${String(userId).slice(0, 8)}_${ts}`,
        subscriptionId: plan ? `sub_${plan}_${ts}` : null,
        invoiceUrl: null,
        credits,
      };
    }

    const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://zwima-group.info";
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
      return { ok: true, mode: "mock", paymentIntentId, status: "refunded" };
    }
    const payload = { payment_intent: paymentIntentId };
    if (amountEur) payload.amount = Math.round(Number(amountEur) * 100);
    return stripeRequest("/refunds", "POST", payload);
  }

  async cancelSubscription({ subscriptionId }) {
    if (!isRealStripeMode()) {
      return { ok: true, subscriptionId, canceledAt: new Date().toISOString(), mode: "mock" };
    }
    return stripeRequest(`/subscriptions/${subscriptionId}`, "DELETE");
  }

  isConfigured() {
    return !paymentMustFailClosed();
  }
}

module.exports = StripePaymentProvider;
