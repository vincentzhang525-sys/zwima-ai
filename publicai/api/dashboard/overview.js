const { getAuthedClient, json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { client, user } = await getAuthedClient(req);
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ data: wallet }, { data: sub }, { data: latestInvoice }, { data: keys }, { data: usageToday }, { data: usageMonth }, { data: usageTotal }, { data: recent }] = await Promise.all([
      client.from("credit_wallets").select("*").eq("user_id", user.id).maybeSingle(),
      client.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("api_keys").select("*").eq("user_id", user.id).eq("status", "Active"),
      client.from("usage_records").select("total_tokens").eq("user_id", user.id).gte("date_time", dayStart),
      client.from("usage_records").select("total_tokens").eq("user_id", user.id).gte("date_time", monthStart),
      client.from("usage_records").select("id").eq("user_id", user.id),
      client.from("usage_records").select("*").eq("user_id", user.id).order("date_time", { ascending: false }).limit(10),
    ]);

    const sumTokens = (rows) => (rows || []).reduce((sum, row) => sum + (Number(row.total_tokens) || 0), 0);
    return json(res, 200, {
      currentPlan: String(sub?.plan || "free").toUpperCase(),
      remainingCredits: Number(wallet?.balance) || 0,
      todayUsage: sumTokens(usageToday),
      monthlyUsage: sumTokens(usageMonth),
      totalApiRequests: Number(usageTotal?.length || 0),
      currentActiveApiKeys: Number(keys?.length || 0),
      latestInvoice: latestInvoice
        ? {
            id: latestInvoice.id,
            amount: Number(latestInvoice.amount) || 0,
            status: latestInvoice.status,
            createdAt: latestInvoice.created_at,
          }
        : null,
      recentActivity: (recent || []).map((row) => ({
        id: row.id,
        provider: row.provider,
        model: row.model,
        prompt: row.prompt,
        dateTime: row.date_time,
      })),
    });
  } catch (err) {
    console.error("[dashboard/overview]", err);
    return json(res, err.status || 500, { error: err.message || "Dashboard overview failed" });
  }
};
