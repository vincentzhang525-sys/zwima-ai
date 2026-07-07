const { getAuthedClient, parseBody, json, handleOptions, withCors, writeAuditLog, getClientIp } = require("../lib/supabase");

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

      const { data: wallet, error: walletError } = await client
        .from("credit_wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (walletError) throw walletError;

      let balance = Number(wallet?.balance) || 0;
      let delta = 0;
      let type = "usage";
      let description = body.description || "API usage";

      if (action === "spend") {
        delta = -Math.abs(Number(body.amount) || 0);
        type = "usage";
        if (!delta) return json(res, 400, { error: "Invalid usage amount." });
        if (balance < Math.abs(delta)) {
          return json(res, 402, { error: "Insufficient credits. Please top up your wallet." });
        }
      } else if (action === "topup") {
        const eur = Number(body.amountEur);
        if (!eur || eur <= 0) return json(res, 400, { error: "Please enter a valid top-up amount." });
        delta = Math.round(eur * 1000);
        type = "topup";
        description = body.description || `Top-up €${eur} (${delta.toLocaleString()} credits)`;
      } else if (action === "adjustment") {
        delta = Number(body.amount) || 0;
        type = "adjustment";
      } else {
        return json(res, 400, { error: `Unknown action: ${action}` });
      }

      balance += delta;

      const { error: updateError } = await client
        .from("credit_wallets")
        .upsert({ user_id: user.id, balance, currency: "EUR" });
      if (updateError) throw updateError;

      const { error: txnError } = await client.from("credit_transactions").insert({
        user_id: user.id,
        type,
        amount: delta,
        description,
        txn_date: new Date().toISOString().slice(0, 10),
        status: "completed",
      });
      if (txnError) throw txnError;

      await writeAuditLog({
        userId: user.id,
        eventType: "credits",
        action: "credits_changed",
        target: type,
        detail: `${description} (${delta})`,
        ip: getClientIp(req),
        notify: true,
        notificationCategory: "credit",
      });

      return json(res, 200, {
        wallet: { balance, currency: "EUR" },
      });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[credits]", err);
    return json(res, err.status || 500, { error: err.message || "Credits request failed" });
  }
};
