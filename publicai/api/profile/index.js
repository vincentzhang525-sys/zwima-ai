const { getAuthedClient, loadProfile, json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { client, user } = await getAuthedClient(req);
    const profile = await loadProfile(client, user.id);
    const [{ data: usage }, { data: sessions }] = await Promise.all([
      client.from("usage_records").select("*").eq("user_id", user.id).order("date_time", { ascending: false }).limit(200),
      client.from("user_sessions").select("*").eq("user_id", user.id).order("last_seen_at", { ascending: false }).limit(1),
    ]);
    const totalTokens = (usage || []).reduce((sum, row) => sum + (Number(row.total_tokens) || 0), 0);
    return json(res, 200, {
      profile: {
        ...profile,
        avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(profile?.company || profile?.email || "ZWIMA")}`,
        usageSummary: {
          totalRequests: Number(usage?.length || 0),
          totalTokens,
        },
        accountCreated: profile?.createdAt || null,
        lastLogin: sessions?.[0]?.last_seen_at || null,
      },
    });
  } catch (err) {
    console.error("[profile]", err);
    return json(res, err.status || 500, { error: err.message || "Profile request failed" });
  }
};
