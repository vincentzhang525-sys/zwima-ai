const PaymentProvider = require("./PaymentProvider");

class StripePaymentProvider extends PaymentProvider {
  constructor() {
    super("stripe");
  }

  async createCheckout({ userId, plan, amountEur }) {
    const ts = Date.now();
    return {
      provider: this.name,
      status: "completed",
      amountEur,
      checkoutId: `stripe_checkout_${ts}`,
      customerId: `cus_${userId.slice(0, 8)}_${ts}`,
      subscriptionId: `sub_${plan}_${ts}`,
      invoiceUrl: `https://billing.zwima-group.info/invoice/${ts}`,
    };
  }

  async handleWebhook() {
    return { ok: true };
  }

  async cancelSubscription({ subscriptionId }) {
    return { ok: true, subscriptionId, canceledAt: new Date().toISOString() };
  }
}

module.exports = StripePaymentProvider;
