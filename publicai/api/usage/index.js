const { getAuthedClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      let query = client
        .from("usage_records")
        .select("*")
        .eq("user_id", user.id)
        .order("date_time", { ascending: false });
      const provider = String(req.query?.provider || "").trim();
      const model = String(req.query?.model || "").trim();
      const status = String(req.query?.status || "").trim();
      const dateFrom = String(req.query?.dateFrom || "").trim();
      const dateTo = String(req.query?.dateTo || "").trim();
      const search = String(req.query?.search || "").trim();
      const page = Math.max(1, Number(req.query?.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize) || 25));

      if (provider) query = query.eq("provider", provider);
      if (model) query = query.eq("model", model);
      if (status) query = query.eq("status", status);
      if (dateFrom) query = query.gte("date_time", `${dateFrom}T00:00:00.000Z`);
      if (dateTo) query = query.lte("date_time", `${dateTo}T23:59:59.999Z`);
      if (search) query = query.ilike("prompt", `%${search}%`);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;

      return json(res, 200, {
        page,
        pageSize,
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
          creditsDeducted: Number(row.credits_deducted) || 0,
          requestTimeMs: Number(row.request_time_ms) || 0,
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
          credits_deducted: Number(body.creditsDeducted) || 0,
          request_time_ms: Number(body.requestTimeMs) || 0,
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
          creditsDeducted: Number(data.credits_deducted) || 0,
          requestTimeMs: Number(data.request_time_ms) || 0,
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
