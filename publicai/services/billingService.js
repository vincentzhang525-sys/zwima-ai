(function () {
  async function getDb() {
    await window.ZwimaDatabase.init();
    return window.ZwimaDatabase.getRepositories();
  }

  function loadKeys() {
    return getDb()
      .then((db) => db.apiKeys.getKeys())
      .then((keys) => window.ZwimaStorage.get("API_KEYS", null) || keys.map((k) => ({ ...k })));
  }

  function loadActivity() {
    return getDb()
      .then((db) => db.apiKeys.getActivity())
      .then((activity) => window.ZwimaStorage.get("API_KEY_ACTIVITY", null) || [...activity]);
  }

  window.ZwimaBillingService = {
    getProviderOptions() {
      return getDb().then((db) => db.settings.getProviderOptions());
    },
    getApiKeys() {
      return loadKeys();
    },
    saveApiKeys(keys) {
      window.ZwimaStorage.set("API_KEYS", keys);
      return getDb().then((db) => db.apiKeys.setKeys(keys));
    },
    getApiKeyActivity() {
      return loadActivity();
    },
    saveApiKeyActivity(items) {
      window.ZwimaStorage.set("API_KEY_ACTIVITY", items);
      return getDb().then((db) => db.apiKeys.setActivity(items));
    },
    createApiKey(payload) {
      return getDb().then((db) => db.apiKeys.createKey(payload));
    },
    getUsageStatistics() {
      return getDb().then((db) => db.billing.getUsageStatistics());
    },
    getCreditsOverview() {
      return getDb().then((db) => db.credits.getOverview());
    },
    getTransactions() {
      return getDb().then((db) => db.transactions.getHistory());
    },
    getCostBreakdown() {
      return getDb().then((db) => db.billing.getCostBreakdown());
    },
    getProviderUsage() {
      return getDb().then((db) => db.billing.getProviderUsage());
    },
    getMonthlySpending() {
      return getDb().then((db) => db.billing.getMonthlySpending());
    },
    getPaymentMethods() {
      return getDb().then((db) => db.billing.getPaymentMethods());
    },
    getTopUpOptions() {
      return getDb().then((db) => db.settings.getTopUpOptions());
    },
    getPaymentHistory() {
      return window.ZwimaStripeClient.getPaymentHistory();
    },
    getInvoices() {
      return window.ZwimaStripeClient.getInvoices();
    },
    getBillingDashboard() {
      return window.ZwimaStripeClient.getBillingDashboard();
    },
    calculateTopUpPricing(amountEur) {
      const price = Number(amountEur);
      const vatRate = window.ZWIMA_CONFIG?.VAT_RATE || 0.19;
      const creditRate = window.ZWIMA_CONFIG?.CREDIT_RATE_EUR || 0.1;
      const vat = price * vatRate;
      const credits = price / creditRate;
      return { price, vat, total: price + vat, credits };
    },
    createCheckout(amountEur) {
      return window.ZwimaStripeClient.createCheckout(amountEur).then(async (session) => {
        if (session.mode === "mock" && session.sessionId) {
          const completed = await window.ZwimaStripeClient.completeCheckout(session.sessionId);
          return {
            ...session,
            ...completed,
            message: "Credits added successfully via Stripe (Mock Mode).",
          };
        }
        return session;
      });
    },
    confirmTopUp(amountEur) {
      return window.ZwimaDatabase.queryApi("/api/credits/topup", "POST", { amountEur }).then((r) => r.data);
    },
    saveBillingSettings(settings) {
      return window.ZwimaDatabase.queryApi("/api/billing/settings", "POST", settings).then((r) => r.data);
    },
    refund(paymentId) {
      return window.ZwimaStripeClient.refund(paymentId);
    },
  };
})();
