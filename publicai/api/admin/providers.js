const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

const PROVIDERS = [
  { id: "openai", name: "OpenAI", env: "OPENAI_API_KEY" },
  { id: "google", name: "Gemini", env: "GEMINI_API_KEY", alt: "GOOGLE_API_KEY" },
  { id: "anthropic", name: "Claude", env: "ANTHROPIC_API_KEY", alt: "CLAUDE_API_KEY" },
  { id: "deepseek", name: "DeepSeek", env: "DEEPSEEK_API_KEY" },
  { id: "qwen", name: "Qwen", env: "QWEN_API_KEY" },
];

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { data: usage } = await admin.from("usage_records").select("*").gte("date_time", dayStart);
    const { data: errors } = await admin.from("security_events").select("*").eq("event_type", "api_abuse").gte("created_at", dayStart);

    const rows = PROVIDERS.map((p) => {
      const configured = Boolean(process.env[p.env] || (p.alt && process.env[p.alt]));
      const normalized = usage?.filter((u) => String(u.provider || "").toLowerCase().includes(p.name.toLowerCase()) || String(u.provider || "").toLowerCase().includes(p.id)) || [];
      const dailyRequests = normalized.length;
      const last = normalized[0];
      const creditsUsed = normalized.reduce((sum, u) => sum + (Number(u.credits_deducted) || 0), 0);
      const latency = dailyRequests ? Math.round(normalized.reduce((sum, u) => sum + (Number(u.request_time_ms) || 0), 0) / dailyRequests) : 0;
      const errorCount = (errors || []).filter((e) => String(e.detail || "").toLowerCase().includes(p.id)).length;
      return {
        id: p.id,
        name: p.name,
        status: configured ? (errorCount > 50 ? "degraded" : "healthy") : "not_configured",
        latency,
        lastRequest: last?.date_time || null,
        creditsUsed,
        errorCount,
        dailyRequests,
        apiKeyStatus: configured ? "Configured" : "Not Configured",
      };
    });
    return json(res, 200, rows);
  } catch (err) {
    console.error("[admin/providers]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load providers" });
  }
};
