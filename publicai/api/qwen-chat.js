const modelConfig = require("../config/models.js");

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Qwen API key not configured" });

  const body = parseBody(req);
  const modelId = modelConfig.resolveId(body.model) || "qwen-plus";
  const messages = Array.isArray(body.messages) && body.messages.length
    ? body.messages
    : [{ role: "user", content: String(body.prompt || "") }];

  const started = Date.now();
  try {
    const qwenRes = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: Number(body.maxTokens) || 2048,
        temperature: Number(body.temperature ?? 0.7),
      }),
    });
    const json = await qwenRes.json();
    if (!qwenRes.ok) {
      return res.status(qwenRes.status).json({ error: json?.error?.message || "Qwen API error" });
    }
    const content = json.choices?.[0]?.message?.content || "";
    const usage = json.usage || {};
    return res.status(200).json({
      content,
      model: modelId,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Qwen request failed" });
  }
};
