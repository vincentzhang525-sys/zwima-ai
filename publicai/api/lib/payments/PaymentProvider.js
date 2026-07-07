class PaymentProvider {
  constructor(name) {
    this.name = name;
  }

  async createCheckout() {
    throw new Error("createCheckout() is not implemented");
  }

  async handleWebhook() {
    throw new Error("handleWebhook() is not implemented");
  }

  async cancelSubscription() {
    throw new Error("cancelSubscription() is not implemented");
  }
}

module.exports = PaymentProvider;
