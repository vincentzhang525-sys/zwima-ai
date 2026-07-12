const { getAdminClient, json, handleOptions, withCors } = require("../lib/supabase");
const { resolvePaymentProvider } = require("../lib/payments");
const fulfillment = require("../lib/payments/fulfillment");

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.rawBody) return resolve(typeof req.rawBody === "string" ? req.rawBody : req.rawBody.toString("utf8"));
    if (typeof req.body === "string") return resolve(req.body);
    if (Buffer.isBuffer(req.body)) return resolve(req.body.toString("utf8"));
    if (req.body && typeof req.body === "object") return resolve(JSON.stringify(req.body));
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"] || req.headers["Stripe-Signature"];
    const paymentProvider = resolvePaymentProvider("stripe");
    const event = await paymentProvider.handleWebhook(rawBody, signature);
    const admin = getAdminClient();

    if (await fulfillment.isWebhookProcessed(admin, event.id)) {
      return json(res, 200, { ok: true, duplicate: true, eventId: event.id });
    }

    const type = event.type;
    const obj = event.data?.object || {};

    if (type === "checkout.session.completed" && obj.payment_status === "paid") {
      const orderId = obj.metadata?.orderId;
      const credits = Number(obj.metadata?.credits || 0);

      const { data: order } = orderId
        ? await admin.from("orders").select("*").eq("id", orderId).maybeSingle()
        : { data: null };

      if (!order) {
        await fulfillment.markWebhookProcessed(admin, {
          eventId: event.id,
          eventType: type,
          payload: { error: "order_not_found", orderId },
          paymentStatus: "ignored",
        });
        return json(res, 200, { ok: true, ignored: true, reason: "order_not_found" });
      }

      const { data: user } = await admin.from("profiles").select("id, email").eq("id", order.user_id).maybeSingle();

      const result = await fulfillment.fulfillPaidOrder(admin, {
        order,
        user,
        checkout: {
          provider: "stripe",
          checkoutId: obj.id,
          sessionId: obj.id,
          customerId: obj.customer,
          subscriptionId: obj.subscription,
          invoiceUrl: obj.url,
        },
        credits: credits || Number(order.metadata?.credits || 0),
        description: `Stripe checkout ${obj.id}`,
        idempotencyKey: `stripe:event:${event.id}`,
      });

      await fulfillment.markWebhookProcessed(admin, {
        eventId: event.id,
        eventType: type,
        orderId: order.id,
        payload: { orderNumber: order.order_number, remainingCredits: result.remainingCredits },
      });

      return json(res, 200, { ok: true, fulfilled: true, orderId: order.id, ...result });
    }

    if (type === "payment_intent.payment_failed") {
      const orderId = obj.metadata?.orderId;
      if (orderId) {
        await admin.from("orders").update({ status: "failed" }).eq("id", orderId);
      }
      await fulfillment.markWebhookProcessed(admin, {
        eventId: event.id,
        eventType: type,
        orderId: orderId || null,
        payload: { paymentIntent: obj.id },
        paymentStatus: "failed",
      });
      return json(res, 200, { ok: true, failed: true });
    }

    if (type === "charge.refunded") {
      const paymentIntent = obj.payment_intent;
      const { data: order } = await admin
        .from("orders")
        .select("*")
        .eq("provider_ref", paymentIntent)
        .maybeSingle();
      if (order) {
        await fulfillment.reverseOrderPayment(admin, {
          order,
          userId: order.user_id,
          reason: `Stripe refund ${event.id}`,
          idempotencyKey: `stripe:refund:${event.id}`,
        });
      }
      await fulfillment.markWebhookProcessed(admin, {
        eventId: event.id,
        eventType: type,
        orderId: order?.id || null,
        payload: { paymentIntent },
        paymentStatus: "refunded",
      });
      return json(res, 200, { ok: true, refunded: true });
    }

    await fulfillment.markWebhookProcessed(admin, {
      eventId: event.id,
      eventType: type,
      payload: { ignored: true },
      paymentStatus: "ignored",
    });
    return json(res, 200, { ok: true, ignored: true, type });
  } catch (err) {
    console.error("[billing/webhook]", err.message);
    const status = err.status || (err.code === "STRIPE_SIGNATURE_INVALID" ? 400 : 500);
    return json(res, status, { error: err.message || "Webhook processing failed" });
  }
};

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
