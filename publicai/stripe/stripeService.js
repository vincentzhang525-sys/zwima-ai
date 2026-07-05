(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaStripeService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const StripeConfig =
    typeof ZwimaStripeConfig !== "undefined" ? ZwimaStripeConfig : require("./stripeConfig");

  function encodeForm(data) {
    return Object.entries(data)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
  }

  async function stripeRequest(path, method, formData) {
    const secret = StripeConfig.getSecretKey();
    if (!secret) {
      const err = new Error("Missing Stripe secret key");
      err.code = 401;
      throw err;
    }
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method: method || "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData ? encodeForm(formData) : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json?.error?.message || `Stripe error ${res.status}`);
      err.code = res.status;
      throw err;
    }
    return json;
  }

  function mockSessionId() {
    return `cs_mock_${Date.now()}`;
  }

  function mockPaymentIntentId() {
    return `pi_mock_${Date.now()}`;
  }

  function createStripeService(repos) {
    return {
      calcPricing: StripeConfig.calcPricing,

      async createCheckoutSession({ amountEur, userId, successUrl, cancelUrl, email }) {
        const pricing = StripeConfig.calcPricing(amountEur);
        const metadata = {
          userId: userId || "user-demo-1",
          credits: String(pricing.credits),
          amountEur: String(pricing.price),
        };

        if (StripeConfig.isMockMode()) {
          const sessionId = mockSessionId();
          const payment = await repos.payments.create({
            id: `pay-${Date.now()}`,
            sessionId,
            paymentIntentId: mockPaymentIntentId(),
            userId: metadata.userId,
            amountEur: pricing.total,
            baseAmountEur: pricing.price,
            vatEur: pricing.vat,
            credits: pricing.credits,
            currency: "EUR",
            status: "pending",
            provider: "Stripe",
            mode: "mock",
            createdAt: new Date().toISOString(),
          });
          return {
            mode: "mock",
            sessionId,
            paymentId: payment.id,
            checkoutUrl: null,
            pricing,
            message: "Mock checkout session created",
          };
        }

        const session = await stripeRequest("/checkout/sessions", "POST", {
          mode: "payment",
          success_url: successUrl || "http://localhost:8787/credits.html?payment=success",
          cancel_url: cancelUrl || "http://localhost:8787/credits.html?payment=cancelled",
          "line_items[0][price_data][currency]": "eur",
          "line_items[0][price_data][unit_amount]": Math.round(pricing.total * 100),
          "line_items[0][price_data][product_data][name]": `ZWIMA Credits (${pricing.credits})`,
          "line_items[0][quantity]": 1,
          customer_email: email,
          "metadata[userId]": metadata.userId,
          "metadata[credits]": metadata.credits,
          "metadata[amountEur]": metadata.amountEur,
        });

        await repos.payments.create({
          id: `pay-${Date.now()}`,
          sessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          userId: metadata.userId,
          amountEur: pricing.total,
          baseAmountEur: pricing.price,
          vatEur: pricing.vat,
          credits: pricing.credits,
          currency: "EUR",
          status: "pending",
          provider: "Stripe",
          mode: "test",
          checkoutUrl: session.url,
          createdAt: new Date().toISOString(),
        });

        return {
          mode: "test",
          sessionId: session.id,
          checkoutUrl: session.url,
          pricing,
        };
      },

      async completePayment({ sessionId, paymentIntentId, status }) {
        const payment =
          (sessionId && (await repos.payments.findBySessionId(sessionId))) ||
          (paymentIntentId && (await repos.payments.findByPaymentIntentId(paymentIntentId)));

        if (!payment) {
          const err = new Error("Payment not found");
          err.code = 404;
          throw err;
        }
        if (payment.status === "succeeded") {
          return { payment, alreadyCompleted: true };
        }

        const finalStatus = status || "succeeded";
        if (finalStatus === "failed") {
          await repos.payments.update(payment.id, { status: "failed", failedAt: new Date().toISOString() });
          await repos.transactions.create({
            date: new Date().toISOString().slice(0, 10),
            amount: `€${payment.amountEur.toFixed(2)}`,
            credits: String(payment.credits),
            provider: "Stripe",
            status: "Failed",
            invoice: "—",
            paymentId: payment.id,
          });
          return { payment: { ...payment, status: "failed" }, failed: true };
        }

        const invoice = await repos.invoices.createFromPayment(payment);
        const transaction = await repos.transactions.create({
          date: new Date().toISOString().slice(0, 10),
          amount: `€${payment.amountEur.toFixed(2)}`,
          credits: String(payment.credits),
          provider: "Stripe",
          status: "Completed",
          invoice: invoice.id,
          paymentId: payment.id,
        });

        const balance = await repos.credits.addCredits(payment.credits);
        await repos.payments.update(payment.id, {
          status: "succeeded",
          invoiceId: invoice.id,
          transactionId: transaction.id,
          completedAt: new Date().toISOString(),
        });

        return {
          payment: await repos.payments.findById(payment.id),
          invoice,
          transaction,
          balance,
        };
      },

      async processRefund({ paymentId, paymentIntentId }) {
        const payment =
          (paymentId && (await repos.payments.findById(paymentId))) ||
          (paymentIntentId && (await repos.payments.findByPaymentIntentId(paymentIntentId)));
        if (!payment || payment.status !== "succeeded") {
          const err = new Error("Payment not refundable");
          err.code = 400;
          throw err;
        }

        if (!StripeConfig.isMockMode()) {
          await stripeRequest("/refunds", "POST", { payment_intent: payment.paymentIntentId });
        }

        await repos.credits.addCredits(-payment.credits);
        await repos.payments.update(payment.id, { status: "refunded", refundedAt: new Date().toISOString() });
        const refundInvoice = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-R`;
        await repos.transactions.create({
          date: new Date().toISOString().slice(0, 10),
          amount: `€${payment.amountEur.toFixed(2)}`,
          credits: String(payment.credits),
          provider: "Stripe",
          status: "Refunded",
          invoice: refundInvoice,
          paymentId: payment.id,
        });

        return { paymentId: payment.id, status: "refunded", creditsRemoved: payment.credits };
      },
    };
  }

  return { createStripeService, stripeRequest };
});
