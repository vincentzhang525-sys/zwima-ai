const { getAuthedClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      const { data, error } = await client
        .from("usage_records")
        .select("*")
        .eq("user_id", user.id)
        .order("date_time", { ascending: false })
        .limit(500);
      if (error) throw error;

      return json(res, 200, {
        records: (data || []).map((row) => ({
          id: row.id,
          dateTime: row.date_time,
          provider: row.provider,
          model: row.model,
          prompt: row.prompt,
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          totalTokens: row.total_tokens,
          estimatedCost: Number(row.estimated_cost),
          remainingCredits: Number(row.remaining_credits),
          status: row.status,
        })),
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const inputTokens = Number(body.inputTokens) || 0;
      const outputTokens = Number(body.outputTokens) || 0;
      const totalTokens = Number(body.totalTokens) || inputTokens + outputTokens;

      const { data, error } = await client
        .from("usage_records")
        .insert({
          user_id: user.id,
          provider: body.provider || "—",
          model: body.model || "—",
          prompt: body.prompt || "",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          estimated_cost: body.estimatedCost ?? totalTokens * 0.000002,
          remaining_credits: Number(body.remainingCredits) || 0,
          status: body.status || "Success",
        })
        .select("*")
        .single();

      if (error) throw error;

      return json(res, 200, {
        record: {
          id: data.id,
          dateTime: data.date_time,
          provider: data.provider,
          model: data.model,
          prompt: data.prompt,
          inputTokens: data.input_tokens,
          outputTokens: data.output_tokens,
          totalTokens: data.total_tokens,
          estimatedCost: Number(data.estimated_cost),
          remainingCredits: Number(data.remaining_credits),
          status: data.status,
        },
      });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[usage]", err);
    return json(res, err.status || 500, { error: err.message || "Usage request failed" });
  }
};
