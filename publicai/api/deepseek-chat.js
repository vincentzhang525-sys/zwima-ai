const modelConfig = require("../config/models.js");

const DEEPSEEK_MODEL_MAP = {
  "deepseek-v3": "deepseek-chat",
  "deepseek-r1": "deepseek-reasoner",
};

const REASONING_MODELS = new Set(["deepseek-reasoner"]);

function resolveModel(modelRef) {
  const modelId = modelConfig.resolveId(modelRef);
  return DEEPSEEK_MODEL_MAP[modelId] || modelId;
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

function buildSystem(customInstructions) {
  const now = new Date();
  const utc = now.toISOString();
  const local = now.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = [
    "You are DeepSeek, a helpful AI assistant on the ZWIMA AI Playground.",
    `Current UTC time: ${utc}.`,
    `Current Asia/Shanghai time: ${local}.`,
    "Answer clearly and naturally in the same language the user uses.",
  ];

  if (customInstructions && String(customInstructions).trim()) {
    parts.unshift(String(customInstructions).trim());
  }

  return parts.join("\n");
}

function buildMessages(messages, prompt) {
  const items = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: "user", content: String(prompt || "") }];

  return items
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: String(item.content || ""),
    }));
}

function buildPayload(body) {
  const modelId = resolveModel(body.model);
  const maxTokens = Number(body.maxTokens) || 2048;
  const stream = Boolean(body.stream);

  const payload = {
    model: modelId,
    messages: [
      { role: "system", content: buildSystem(body.instructions) },
      ...buildMessages(body.messages, body.prompt),
    ],
    max_tokens: maxTokens,
    stream,
  };

  if (!REASONING_MODELS.has(modelId)) {
    payload.temperature = Number(body.temperature ?? 0.7);
  }

  if (stream) {
    payload.stream_options = { include_usage: true };
  }

  return { modelId, payload };
}

function mapUsage(usage) {
  const inputTokens = Number(usage?.prompt_tokens) || 0;
  const outputTokens = Number(usage?.completion_tokens) || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usage?.total_tokens) || inputTokens + outputTokens,
  };
}

function extractContent(message) {
  if (!message) return "";
  return String(message.content || "").trim();
}

async function handleNonStream(req, res, body) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const { modelId, payload } = buildPayload(body);
  const started = Date.now();

  const deepseekRes = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, stream: false }),
  });

  const json = await deepseekRes.json().catch(() => ({}));

  if (!deepseekRes.ok) {
    console.error("[deepseek-chat] API error:", JSON.stringify(json, null, 2));
    return res.status(deepseekRes.status).json({
      error: json?.error?.message || `DeepSeek API error ${deepseekRes.status}`,
      details: json?.error || json,
    });
  }

  const content = extractContent(json.choices?.[0]?.message);
  if (!content) {
    console.error("[deepseek-chat] Empty output:", JSON.stringify(json, null, 2));
    return res.status(502).json({
      error: "DeepSeek returned an empty response",
      details: json,
    });
  }

  return res.status(200).json({
    content,
    model: modelId,
    usage: mapUsage(json.usage),
    latencyMs: Date.now() - started,
  });
}

async function handleStream(req, res, body) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const { payload } = buildPayload(body);

  const deepseekRes = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!deepseekRes.ok) {
    const json = await deepseekRes.json().catch(() => ({}));
    console.error("[deepseek-chat] Stream error:", JSON.stringify(json, null, 2));
    return res.status(deepseekRes.status).json({
      error: json?.error?.message || `DeepSeek API error ${deepseekRes.status}`,
      details: json?.error || json,
    });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const reader = deepseekRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (err) {
    console.error("[deepseek-chat] Stream pipe failed:", err);
  } finally {
    res.end();
  }
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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "DeepSeek API key not configured" });
  }

  const body = parseBody(req);

  try {
    if (body.stream) {
      return handleStream(req, res, body);
    }
    return handleNonStream(req, res, body);
  } catch (err) {
    console.error("[deepseek-chat] Request failed:", err);
    return res.status(500).json({
      error: err.message || "DeepSeek request failed",
    });
  }
};
