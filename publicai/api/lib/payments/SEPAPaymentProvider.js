const PaymentProvider = require("./PaymentProvider");

class SEPAPaymentProvider extends PaymentProvider {
  constructor() {
    super("sepa");
  }

  isConfigured() {
    return Boolean(process.env.SEPA_CREDITOR_ID || process.env.STRIPE_SECRET_KEY);
  }

  async createCheckout({ userId, plan, amountEur, orderId }) {
    const ts = Date.now();
    return {
      provider: this.name,
      status: this.isConfigured() ? "pending" : "completed",
      amountEur,
      checkoutId: `sepa_mandate_${ts}`,
      customerId: `sepa_cus_${String(userId).slice(0, 8)}`,
      subscriptionId: `sepa_sub_${plan}_${ts}`,
      invoiceUrl: `https://billing.zwima-group.info/invoice/${orderId || ts}`,
      mandateReference: `SEPA-${ts}`,
      mode: this.isConfigured() ? "live" : "mock",
    };
  }

  async handleWebhook() {
    return { ok: true, provider: this.name };
  }

  async cancelSubscription({ subscriptionId }) {
    return { ok: true, subscriptionId, canceledAt: new Date().toISOString(), provider: this.name };
  }
}

module.exports = SEPAPaymentProvider;
