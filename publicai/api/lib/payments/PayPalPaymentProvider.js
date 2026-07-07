const PaymentProvider = require("./PaymentProvider");

class PayPalPaymentProvider extends PaymentProvider {
  constructor() {
    super("paypal");
  }

  isConfigured() {
    return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  }

  async createCheckout({ userId, plan, amountEur, orderId }) {
    const ts = Date.now();
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        status: "completed",
        amountEur,
        checkoutId: `paypal_mock_${ts}`,
        customerId: `paypal_cus_${String(userId).slice(0, 8)}`,
        subscriptionId: `paypal_sub_${plan}_${ts}`,
        invoiceUrl: `https://billing.zwima-group.info/invoice/${orderId || ts}`,
        mode: "mock",
      };
    }
    return {
      provider: this.name,
      status: "pending",
      amountEur,
      checkoutId: `paypal_order_${ts}`,
      redirectUrl: `https://www.paypal.com/checkoutnow?token=mock_${ts}`,
      mode: "live",
    };
  }

  async handleWebhook() {
    return { ok: true, provider: this.name };
  }

  async cancelSubscription({ subscriptionId }) {
    return { ok: true, subscriptionId, canceledAt: new Date().toISOString(), provider: this.name };
  }
}

module.exports = PayPalPaymentProvider;
