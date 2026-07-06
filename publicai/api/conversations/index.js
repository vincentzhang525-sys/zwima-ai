const { getAuthedClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");

function mapConversation(row) {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    model: row.model,
    messages: row.messages || [],
    timestamp: row.updated_at || row.created_at,
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      const { data, error } = await client
        .from("playground_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return json(res, 200, { conversations: (data || []).map(mapConversation) });
    }

    if (req.method === "PATCH") {
      const body = parseBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: "Conversation id is required." });

      const { data, error } = await client
        .from("playground_conversations")
        .update({
          title: body.title || "Conversation",
          provider: body.provider || null,
          model: body.model || null,
          messages: body.messages || [],
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) throw error;

      return json(res, 200, { conversation: mapConversation(data) });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const payload = {
        user_id: user.id,
        title: body.title || "Conversation",
        provider: body.provider || null,
        model: body.model || null,
        messages: body.messages || [],
      };

      const { data, error } = await client
        .from("playground_conversations")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;

      const rows = await client
        .from("playground_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if ((rows.data || []).length > 5) {
        const stale = rows.data.slice(5).map((row) => row.id);
        if (stale.length) {
          await client.from("playground_conversations").delete().in("id", stale);
        }
      }

      return json(res, 200, { conversation: mapConversation(data) });
    }

    if (req.method === "DELETE") {
      const body = parseBody(req);
      const id = body.id || req.query?.id;
      if (!id) return json(res, 400, { error: "Conversation id is required." });
      const { error } = await client
        .from("playground_conversations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      return json(res, 200, { success: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[conversations]", err);
    return json(res, err.status || 500, { error: err.message || "Conversations request failed" });
  }
};
