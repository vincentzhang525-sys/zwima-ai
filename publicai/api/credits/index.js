const { getAuthedClient, getAdminClient, parseBody, json, handleOptions, withCors, writeAuditLog, getClientIp } = require("../lib/supabase");
const { requireAdmin } = require("../admin/_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      const [{ data: wallet, error: walletError }, { data: txns, error: txnError }] =
        await Promise.all([
          client.from("credit_wallets").select("*").eq("user_id", user.id).maybeSingle(),
          client
            .from("credit_transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

      if (walletError) throw walletError;
      if (txnError) throw txnError;

      return json(res, 200, {
        wallet: {
          balance: Number(wallet?.balance) || 0,
          currency: wallet?.currency || "EUR",
          transactions: (txns || []).map((row) => ({
            id: row.id,
            type: row.type,
            amount: Number(row.amount),
            description: row.description,
            date: row.txn_date,
            status: row.status,
          })),
        },
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const action = body.action || "spend";

      if (action === "topup" || action === "adjustment") {
        return json(res, 403, {
          error: "Credit top-ups must be purchased via billing. Use /api/billing with Stripe checkout.",
        });
      }

      if (action !== "spend") {
        return json(res, 400, { error: `Unknown action: ${action}` });
      }

      const { data: wallet, error: walletError } = await client
        .from("credit_wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (walletError) throw walletError;

      const balance = Number(wallet?.balance) || 0;
      const delta = -Math.abs(Number(body.amount) || 0);
      if (!delta) return json(res, 400, { error: "Invalid usage amount." });
      if (balance < Math.abs(delta)) {
        return json(res, 402, { error: "Insufficient credits. Please purchase credits via billing." });
      }

      const newBalance = balance + delta;
      const { error: updateError } = await client
        .from("credit_wallets")
        .upsert({ user_id: user.id, balance: newBalance, currency: "EUR" });
      if (updateError) throw updateError;

      const { error: txnError } = await client.from("credit_transactions").insert({
        user_id: user.id,
        type: "usage",
        amount: delta,
        description: body.description || "API usage",
        txn_date: new Date().toISOString().slice(0, 10),
        status: "completed",
      });
      if (txnError) throw txnError;

      await writeAuditLog({
        userId: user.id,
        eventType: "credits",
        action: "credits_changed",
        target: "usage",
        detail: `${body.description || "API usage"} (${delta})`,
        ip: getClientIp(req),
      });

      return json(res, 200, {
        wallet: { balance: newBalance, currency: "EUR" },
      });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[credits]", err);
    return json(res, err.status || 500, { error: err.message || "Credits request failed" });
  }
};
