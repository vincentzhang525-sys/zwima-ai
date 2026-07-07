const PaymentProvider = require("./PaymentProvider");

class GenericMockPaymentProvider extends PaymentProvider {
  constructor(name) {
    super(name);
  }

  async createCheckout({ userId, plan, amountEur }) {
    const ts = Date.now();
    return {
      provider: this.name,
      status: "completed",
      amountEur,
      checkoutId: `${this.name}_checkout_${ts}`,
      customerId: `${this.name}_cus_${userId.slice(0, 8)}_${ts}`,
      subscriptionId: `${this.name}_sub_${plan}_${ts}`,
      invoiceUrl: `https://billing.zwima-group.info/invoice/${this.name}/${ts}`,
    };
  }

  async handleWebhook() {
    return { ok: true };
  }

  async cancelSubscription({ subscriptionId }) {
    return { ok: true, subscriptionId, canceledAt: new Date().toISOString() };
  }
}

module.exports = GenericMockPaymentProvider;
