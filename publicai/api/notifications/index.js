const { getAuthedClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json(res, 200, {
        unread: (data || []).filter((row) => !row.is_read).length,
        notifications: (data || []).map((row) => ({
          id: row.id,
          category: row.category,
          title: row.title,
          message: row.message,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        })),
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      if (body.action === "markAllRead") {
        const { error } = await client.from("notifications").update({ is_read: true }).eq("user_id", user.id);
        if (error) throw error;
        return json(res, 200, { ok: true });
      }
      return json(res, 400, { error: "Unknown notification action" });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[notifications]", err);
    return json(res, err.status || 500, { error: err.message || "Notifications request failed" });
  }
};
