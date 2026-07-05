(function () {
  window.ZwimaStripeClient = {
    createCheckout(amountEur) {
      return window.ZwimaDatabase.queryApi("/api/billing/checkout", "POST", { amountEur }).then((r) => r.data);
    },
    completeCheckout(sessionId) {
      return window.ZwimaDatabase.queryApi("/api/billing/complete", "POST", { sessionId }).then((r) => r.data);
    },
    getPaymentHistory() {
      return window.ZwimaDatabase.queryApi("/api/billing/payments", "GET").then((r) => r.data);
    },
    getInvoices() {
      return window.ZwimaDatabase.queryApi("/api/billing/invoices", "GET").then((r) => r.data);
    },
    getBillingDashboard() {
      return window.ZwimaDatabase.queryApi("/api/billing/dashboard", "GET").then((r) => r.data);
    },
    processWebhook(event) {
      return window.ZwimaDatabase.queryApi("/api/billing/webhook", "POST", event).then((r) => r.data);
    },
    refund(paymentId) {
      return window.ZwimaDatabase.queryApi("/api/billing/refund", "POST", { paymentId }).then((r) => r.data);
    },
    getMode() {
      return window.ZWIMA_CONFIG?.STRIPE_MODE || "mock";
    },
  };
})();
