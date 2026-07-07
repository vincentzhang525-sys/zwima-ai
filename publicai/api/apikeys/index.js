const {
  getAuthedClient,
  parseBody,
  hashApiKey,
  json,
  handleOptions,
  withCors,
} = require("../lib/supabase");

const KEY_PREFIX = "zw_live_";
const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateSecret() {
  let secret = "";
  for (let i = 0; i < 32; i += 1) {
    secret += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `${KEY_PREFIX}${secret}`;
}

function mapKey(row, secret) {
  return {
    id: row.id,
    name: row.name,
    key: secret || `${row.key_prefix}...`,
    createdAt: row.created_at?.slice?.(0, 10) || row.created_at,
    lastUsed: row.last_used ? new Date(row.last_used).toLocaleString("en-GB") : "Never",
    totalUsage: Number(row.total_usage) || 0,
    status: row.status,
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      const { data, error } = await client
        .from("api_keys")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(res, 200, {
        keys: (data || []).map((row) => mapKey(row)),
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const name = String(body.name || "").trim();
      if (!name) return json(res, 400, { error: "Key name is required." });

      const secret = generateSecret();
      const { data, error } = await client
        .from("api_keys")
        .insert({
          user_id: user.id,
          name,
          key_prefix: secret.slice(0, 12),
          key_hash: hashApiKey(secret),
          status: "Active",
        })
        .select("*")
        .single();
      if (error) throw error;

      return json(res, 200, { key: mapKey(data, secret) });
    }

    if (req.method === "PATCH") {
      const body = parseBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: "Key id is required." });

      const updates = {};
      if (body.name != null) updates.name = String(body.name).trim();
      if (body.status != null) updates.status = body.status;

      const { data, error } = await client
        .from("api_keys")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(res, 404, { error: "API key not found." });
      return json(res, 200, { key: mapKey(data) });
    }

    if (req.method === "DELETE") {
      const body = parseBody(req);
      const id = body.id || req.query?.id;
      if (!id) return json(res, 400, { error: "Key id is required." });

      const { error } = await client.from("api_keys").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      return json(res, 200, { success: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[apikeys]", err);
    return json(res, err.status || 500, { error: err.message || "API keys request failed" });
  }
};
