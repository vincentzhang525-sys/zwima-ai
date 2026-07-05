(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaWebhookService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const StripeServiceMod =
    typeof ZwimaStripeService !== "undefined" ? ZwimaStripeService : require("./stripeService");

  const HANDLED_EVENTS = new Set([
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "checkout.session.completed",
    "invoice.payment_succeeded",
  ]);

  function createWebhookService(repos) {
    const stripe = StripeServiceMod.createStripeService(repos);

    return {
      handledEvents: HANDLED_EVENTS,

      async handleEvent(event) {
        const type = event?.type;
        const obj = event?.data?.object || {};

        if (!HANDLED_EVENTS.has(type)) {
          return { handled: false, type };
        }

        if (type === "checkout.session.completed") {
          const result = await stripe.completePayment({
            sessionId: obj.id,
            paymentIntentId: obj.payment_intent,
            status: obj.payment_status === "paid" ? "succeeded" : "failed",
          });
          return { handled: true, type, result };
        }

        if (type === "payment_intent.succeeded") {
          const result = await stripe.completePayment({
            paymentIntentId: obj.id,
            status: "succeeded",
          });
          return { handled: true, type, result };
        }

        if (type === "payment_intent.payment_failed") {
          try {
            const result = await stripe.completePayment({
              paymentIntentId: obj.id,
              status: "failed",
            });
            return { handled: true, type, result };
          } catch (e) {
            if (e.code === 404) return { handled: true, type, ignored: true };
            throw e;
          }
        }

        if (type === "invoice.payment_succeeded") {
          const credits = Number(obj.metadata?.credits || 0);
          const amountEur = Number(obj.metadata?.amountEur || (obj.amount_paid || 0) / 100);
          if (obj.metadata?.sessionId) {
            const result = await stripe.completePayment({ sessionId: obj.metadata.sessionId, status: "succeeded" });
            return { handled: true, type, result };
          }
          if (credits > 0) {
            await repos.credits.addCredits(credits);
          }
          return { handled: true, type, credits, amountEur };
        }

        return { handled: false, type };
      },

      buildMockEvent(type, payload) {
        const base = { id: `evt_mock_${Date.now()}`, type, data: { object: payload } };
        return base;
      },
    };
  }

  return { createWebhookService, HANDLED_EVENTS };
});
