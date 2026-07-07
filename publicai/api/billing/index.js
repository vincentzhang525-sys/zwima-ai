const { getAuthedClient, parseBody, json, handleOptions, withCors, writeAuditLog, getClientIp } = require("../lib/supabase");
const { resolvePaymentProvider } = require("../lib/payments");

const PLAN_CREDITS = {
  free: 500,
  starter: 20000,
  business: 100000,
  enterprise: 500000,
};

const PLAN_PRICES = {
  free: 0,
  starter: 29,
  business: 99,
  enterprise: 499,
};

function currentPlan(raw) {
  const value = String(raw || "free").toLowerCase();
  return PLAN_CREDITS[value] ? value : "free";
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      const [{ data: wallet }, { data: sub }, { data: payments }] = await Promise.all([
        client.from("credit_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        client.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        client.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      return json(res, 200, {
        billing: {
          currentPlan: currentPlan(sub?.plan),
          status: sub?.status || "active",
          remainingCredits: Number(wallet?.balance) || 0,
          renewAt: sub?.renew_at || null,
          paymentMethod: "Card (Provider managed)",
          invoices: (payments || []).map((row) => ({
            id: row.id,
            amount: Number(row.amount) || 0,
            currency: row.currency || "EUR",
            status: row.status,
            invoiceUrl: row.invoice_url,
            createdAt: row.created_at,
          })),
          payments: (payments || []).map((row) => ({
            id: row.id,
            amount: Number(row.amount) || 0,
            currency: row.currency || "EUR",
            status: row.status,
            provider: row.provider || "stripe",
            invoiceUrl: row.invoice_url,
            createdAt: row.created_at,
          })),
        },
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const action = body.action || "upgrade";
      const plan = currentPlan(body.plan);
      const provider = String(body.provider || "stripe").toLowerCase();

      if (action === "cancel") {
        const { data: sub } = await client
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const paymentProvider = resolvePaymentProvider(provider);
        await paymentProvider.cancelSubscription({ subscriptionId: sub?.stripe_subscription_id || "" });
        await client.from("subscriptions").update({ status: "canceled" }).eq("user_id", user.id);
        await writeAuditLog({
          userId: user.id,
          eventType: "billing",
          action: "billing_updated",
          target: "subscription",
          detail: "Subscription canceled",
          ip: getClientIp(req),
          notify: true,
          notificationCategory: "billing",
        });
        return json(res, 200, { ok: true, status: "canceled" });
      }

      const amountEur = PLAN_PRICES[plan] || 0;
      const credits = PLAN_CREDITS[plan] || 0;
      const paymentProvider = resolvePaymentProvider(provider);
      const checkout = await paymentProvider.createCheckout({
        userId: user.id,
        plan,
        amountEur,
      });

      const { data: wallet } = await client.from("credit_wallets").select("*").eq("user_id", user.id).maybeSingle();
      const current = Number(wallet?.balance) || 0;
      const next = current + credits;

      await client.from("credit_wallets").upsert({ user_id: user.id, balance: next, currency: "EUR" });
      await client.from("credit_transactions").insert({
        user_id: user.id,
        type: "topup",
        amount: credits,
        description: `Subscription ${plan.toUpperCase()} payment (${checkout.provider})`,
        txn_date: new Date().toISOString().slice(0, 10),
        status: "completed",
      });
      await client.from("payments").insert({
        user_id: user.id,
        amount: amountEur,
        currency: "EUR",
        status: checkout.status,
        provider: checkout.provider,
        invoice_url: checkout.invoiceUrl,
      });
      await client.from("subscriptions").insert({
        user_id: user.id,
        plan,
        status: "active",
        credits,
        renew_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_customer_id: checkout.customerId,
        stripe_subscription_id: checkout.subscriptionId,
      });
      await writeAuditLog({
        userId: user.id,
        eventType: "billing",
        action: "billing_updated",
        target: plan,
        detail: `Plan upgraded via ${checkout.provider}`,
        ip: getClientIp(req),
        notify: true,
        notificationCategory: "billing",
      });

      return json(res, 200, {
        ok: true,
        plan,
        provider: checkout.provider,
        creditsAdded: credits,
        remainingCredits: next,
        renewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceUrl: checkout.invoiceUrl,
      });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[billing]", err);
    return json(res, err.status || 500, { error: err.message || "Billing request failed" });
  }
};
