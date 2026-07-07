const PaymentProvider = require("./PaymentProvider");

class ManualInvoicePaymentProvider extends PaymentProvider {
  constructor() {
    super("manual_invoice");
  }

  async createCheckout({ userId, plan, amountEur, orderId }) {
    const ts = Date.now();
    return {
      provider: this.name,
      status: "pending",
      amountEur,
      checkoutId: `manual_inv_${ts}`,
      customerId: `manual_cus_${String(userId).slice(0, 8)}`,
      subscriptionId: null,
      invoiceUrl: `https://billing.zwima-group.info/invoice/${orderId || ts}`,
      paymentTerms: "Net 30",
      mode: "manual",
    };
  }

  async handleWebhook() {
    return { ok: true, provider: this.name };
  }

  async cancelSubscription() {
    return { ok: true, provider: this.name };
  }
}

module.exports = ManualInvoicePaymentProvider;
