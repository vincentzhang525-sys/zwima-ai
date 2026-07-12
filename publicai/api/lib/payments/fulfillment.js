const ledger = require("../credits/ledger");
const { sendTransactional } = require("../email");

async function isWebhookProcessed(admin, eventId) {
  const { data } = await admin.from("stripe_webhook_events").select("id").eq("event_id", eventId).maybeSingle();
  return Boolean(data);
}

async function markWebhookProcessed(admin, { eventId, eventType, orderId, payload, paymentStatus = "processed" }) {
  const { error } = await admin.from("stripe_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    order_id: orderId || null,
    payment_status: paymentStatus,
    payload: payload || {},
  });
  if (error && !String(error.message || "").includes("duplicate")) throw error;
}

async function fulfillPaidOrder(admin, { order, user, checkout, credits, description, idempotencyKey, sendEmails = true }) {
  if (!order || order.status === "completed") {
    const { data: wallet } = await admin.from("credit_wallets").select("balance").eq("user_id", order.user_id).maybeSingle();
    return { alreadyCompleted: true, remainingCredits: Number(wallet?.balance) || 0, order };
  }

  const creditResult = await ledger.creditAtomic(admin, {
    userId: order.user_id,
    amount: credits,
    type: "topup",
    description,
    referenceType: "order",
    referenceId: order.id,
    idempotencyKey: idempotencyKey || `order:${order.id}:fulfill`,
  });

  await admin.from("commerce_transactions").insert({
    user_id: order.user_id,
    order_id: order.id,
    provider: checkout.provider,
    provider_ref: checkout.checkoutId || checkout.sessionId,
    amount: order.total,
    currency: order.currency,
    status: "completed",
  });

  await admin.from("payments").insert({
    user_id: order.user_id,
    amount: order.total,
    currency: order.currency,
    status: "completed",
    provider: checkout.provider,
    invoice_url: checkout.invoiceUrl || null,
  });

  const invoice = ledger.buildInvoiceRecordWithCompany({
    userId: order.user_id,
    orderId: order.id,
    currency: order.currency,
    subtotal: order.subtotal,
    tax: order.tax,
    total: order.total,
  });
  const { data: inv } = await admin.from("invoices").insert(invoice).select().single();

  await admin
    .from("orders")
    .update({ status: "completed", provider_ref: checkout.checkoutId || checkout.sessionId || order.provider_ref })
    .eq("id", order.id);

  if (order.order_type === "subscription" && order.plan_id) {
    const { data: planRow } = await admin.from("subscription_plans").select("*").eq("id", order.plan_id).maybeSingle();
    await admin.from("subscriptions").insert({
      user_id: order.user_id,
      plan: order.plan_id,
      status: "active",
      credits: Number(planRow?.monthly_credits) || credits,
      renew_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      stripe_customer_id: checkout.customerId || null,
      stripe_subscription_id: checkout.subscriptionId || null,
    });
  }

  if (sendEmails && user?.email) {
    try {
      if (order.order_type === "credit_package") {
        await sendTransactional("creditPurchase", user.email, { credits, amount: order.total });
      } else {
        await sendTransactional("billingReceipt", user.email, {
          plan: order.plan_id,
          amount: order.total,
          orderNumber: order.order_number,
        });
      }
    } catch (mailErr) {
      console.error("[fulfillment] email", mailErr.message);
    }
  }

  return {
    alreadyCompleted: creditResult.alreadyApplied,
    remainingCredits: creditResult.balance,
    invoice: inv,
    txnId: creditResult.txnId,
  };
}

async function reverseOrderPayment(admin, { order, userId, reason, idempotencyKey, actorId }) {
  const creditsToReverse = Number(order.metadata?.credits || 0);
  if (!creditsToReverse) {
    const { data: pkg } = order.package_id
      ? await admin.from("credit_packages").select("credits").eq("id", order.package_id).maybeSingle()
      : { data: null };
    const { data: plan } = order.plan_id
      ? await admin.from("subscription_plans").select("monthly_credits").eq("id", order.plan_id).maybeSingle()
      : { data: null };
    const fallbackCredits = Number(pkg?.credits || plan?.monthly_credits || 0);
    if (fallbackCredits) {
      await ledger.creditAtomic(admin, {
        userId,
        amount: -fallbackCredits,
        type: "refund",
        description: reason || `Refund order ${order.order_number}`,
        referenceType: "order",
        referenceId: order.id,
        idempotencyKey: idempotencyKey || `order:${order.id}:refund`,
        actorId,
        actorType: "system",
      });
    }
  } else {
    await ledger.creditAtomic(admin, {
      userId,
      amount: -Math.abs(creditsToReverse),
      type: "refund",
      description: reason || `Refund order ${order.order_number}`,
      referenceType: "order",
      referenceId: order.id,
      idempotencyKey: idempotencyKey || `order:${order.id}:refund`,
      actorId,
      actorType: "system",
    });
  }

  await admin.from("orders").update({ status: "refunded" }).eq("id", order.id);
  await admin.from("commerce_transactions").insert({
    user_id: userId,
    order_id: order.id,
    provider: order.provider,
    provider_ref: order.provider_ref,
    amount: -Number(order.total),
    currency: order.currency,
    status: "refunded",
  });
}

module.exports = {
  isWebhookProcessed,
  markWebhookProcessed,
  fulfillPaidOrder,
  reverseOrderPayment,
};
