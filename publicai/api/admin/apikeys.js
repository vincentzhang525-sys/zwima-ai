const { parseBody, json, handleOptions, withCors, hashApiKey } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

function randomSecret() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "zw_live_";
  for (let i = 0; i < 32; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  try {
    const { admin } = await requireAdmin(req);
    if (req.method === "GET") {
      const { data } = await admin.from("api_keys").select("*").order("created_at", { ascending: false }).limit(200);
      return json(
        res,
        200,
        (data || []).map((k) => ({
          id: k.id,
          name: k.name,
          prefix: `${k.key_prefix}...`,
          status: k.status,
          quota: "—",
          usage: Number(k.total_usage) || 0,
        }))
      );
    }
    const body = parseBody(req);
    if (req.method === "POST" && req.query?.action === "create") {
      const userId = String(body.userId || "");
      const name = String(body.name || "Admin Key").trim();
      if (!userId) return json(res, 400, { error: "userId required" });
      const secret = randomSecret();
      const { error } = await admin.from("api_keys").insert({
        user_id: userId,
        name,
        key_prefix: secret.slice(0, 12),
        key_hash: hashApiKey(secret),
        status: "Active",
      });
      if (error) throw error;
      return json(res, 200, { success: true });
    }
    if (req.method === "POST" && req.query?.action === "toggle") {
      await admin.from("api_keys").update({ status: body.enabled ? "Active" : "Disabled" }).eq("id", body.keyId);
      return json(res, 200, { success: true });
    }
    if (req.method === "POST" && req.query?.action === "delete") {
      await admin.from("api_keys").delete().eq("id", body.keyId);
      return json(res, 200, { success: true });
    }
    if (req.method === "POST" && req.query?.action === "quota") {
      return json(res, 200, { success: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[admin/apikeys]", err);
    return json(res, err.status || 500, { error: err.message || "Failed admin apikeys request" });
  }
};
