const MODEL_MAP = {
  "GPT-4o": "gpt-4o",
  "GPT-4.1": "gpt-4-turbo",
  "o1-mini": "o1-mini",
};

const REASONING_MODELS = new Set(["o1-mini", "o1-preview", "o1"]);

function resolveModel(displayModel) {
  return MODEL_MAP[displayModel] || String(displayModel || "gpt-4o").toLowerCase();
}

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

function buildInput(messages, prompt) {
  if (Array.isArray(messages) && messages.length) {
    return messages
      .filter((item) => item && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({ role: item.role, content: String(item.content || "") }));
  }
  return [{ role: "user", content: String(prompt || "") }];
}

function extractOutputText(json) {
  if (typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text.trim();
  }

  const chunks = [];
  for (const item of json.output || []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part.type === "output_text" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  const body = parseBody(req);
  const apiModel = resolveModel(body.model);
  const input = buildInput(body.messages, body.prompt);
  const maxOutputTokens = Number(body.maxTokens) || 2048;

  const payload = {
    model: apiModel,
    input,
    max_output_tokens: maxOutputTokens,
  };

  if (!REASONING_MODELS.has(apiModel)) {
    payload.temperature = Number(body.temperature ?? 0.7);
  }

  const started = Date.now();

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await openaiRes.json().catch(() => ({}));

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: json?.error?.message || `OpenAI API error ${openaiRes.status}`,
      });
    }

    const content = extractOutputText(json);
    if (!content) {
      return res.status(502).json({ error: "OpenAI returned an empty response" });
    }

    const usage = json.usage || {};
    const inputTokens = Number(usage.input_tokens) || 0;
    const outputTokens = Number(usage.output_tokens) || 0;
    const totalTokens = Number(usage.total_tokens) || inputTokens + outputTokens;

    return res.status(200).json({
      content,
      model: apiModel,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "OpenAI request failed",
    });
  }
};
