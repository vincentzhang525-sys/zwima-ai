const modelConfig = require("../config/models.js");

function resolveModel(modelRef) {
  return modelConfig.resolveId(modelRef);
}

function isReasoningModel(modelRef) {
  return modelConfig.isReasoningModel(modelRef);
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

function buildInstructions(customInstructions) {
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
    "You are a helpful AI assistant on the ZWIMA AI Playground.",
    `Current UTC time: ${utc}.`,
    `Current Asia/Shanghai time: ${local}.`,
    "Answer clearly and naturally in the same language the user uses.",
  ];

  if (customInstructions && String(customInstructions).trim()) {
    parts.unshift(String(customInstructions).trim());
  }

  return parts.join("\n");
}

function toInputTextContent(text) {
  return [{ type: "input_text", text: String(text || "") }];
}

function buildInput(messages, prompt) {
  const items = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: "user", content: String(prompt || "") }];

  const formatted = items
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      type: "message",
      role: item.role,
      content:
        item.role === "user"
          ? toInputTextContent(item.content)
          : [{ type: "output_text", text: String(item.content || "") }],
    }));

  if (formatted.length === 1 && formatted[0].role === "user") {
    const text = formatted[0].content[0]?.text;
    if (text) return text;
  }

  return formatted;
}

function buildPayload(body) {
  const apiModel = resolveModel(body.model);
  const maxOutputTokens = Number(body.maxTokens) || 2048;
  const payload = {
    model: apiModel,
    instructions: buildInstructions(body.instructions),
    input: buildInput(body.messages, body.prompt),
    max_output_tokens: maxOutputTokens,
    store: false,
  };

  if (!isReasoningModel(apiModel)) {
    payload.temperature = Number(body.temperature ?? 0.7);
  }

  return { apiModel, payload };
}

function extractOutputText(json) {
  if (json?.status && json.status !== "completed") {
    const reason = json.incomplete_details?.reason || json.status;
    throw new Error(`OpenAI response incomplete: ${reason}`);
  }

  if (typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text.trim();
  }

  const output = Array.isArray(json.output) ? json.output : [];
  const messageItems = output.filter((item) => item.type === "message" && item.role === "assistant");

  for (let i = messageItems.length - 1; i >= 0; i -= 1) {
    const message = messageItems[i];
    const parts = Array.isArray(message.content) ? message.content : [];
    const texts = parts
      .filter((part) => part.type === "output_text" && part.text)
      .map((part) => part.text);
    if (texts.length) return texts.join("\n").trim();
  }

  return "";
}

function mapUsage(usage) {
  const inputTokens = Number(usage?.input_tokens) || 0;
  const outputTokens = Number(usage?.output_tokens) || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usage?.total_tokens) || inputTokens + outputTokens,
  };
}

async function handleNonStream(req, res, body) {
  const started = Date.now();
  const { apiModel, payload } = buildPayload(body);

  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await openaiRes.json().catch(() => ({}));

  if (!openaiRes.ok) {
    console.error("[openai-chat] OpenAI API error:", JSON.stringify(json, null, 2));
    return res.status(openaiRes.status).json({
      error: json?.error?.message || `OpenAI API error ${openaiRes.status}`,
      details: json?.error || json,
    });
  }

  if (json.error) {
    console.error("[openai-chat] OpenAI response error:", JSON.stringify(json.error, null, 2));
    return res.status(502).json({
      error: json.error.message || "OpenAI returned an error",
      details: json.error,
    });
  }

  let content;
  try {
    content = extractOutputText(json);
  } catch (extractErr) {
    console.error("[openai-chat] Output extraction failed:", extractErr.message, JSON.stringify(json, null, 2));
    return res.status(502).json({
      error: extractErr.message,
      details: json,
    });
  }

  if (!content) {
    console.error("[openai-chat] Empty output:", JSON.stringify(json, null, 2));
    return res.status(502).json({
      error: "OpenAI returned an empty response",
      details: json,
    });
  }

  return res.status(200).json({
    content,
    model: json.model || apiModel,
    usage: mapUsage(json.usage),
    latencyMs: Date.now() - started,
  });
}

async function handleStream(req, res, body) {
  const { payload } = buildPayload(body);
  payload.stream = true;

  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!openaiRes.ok) {
    const json = await openaiRes.json().catch(() => ({}));
    console.error("[openai-chat] OpenAI stream error:", JSON.stringify(json, null, 2));
    return res.status(openaiRes.status).json({
      error: json?.error?.message || `OpenAI API error ${openaiRes.status}`,
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

  const reader = openaiRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (err) {
    console.error("[openai-chat] Stream pipe failed:", err);
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  const body = parseBody(req);

  try {
    if (body.stream) {
      return handleStream(req, res, body);
    }
    return handleNonStream(req, res, body);
  } catch (err) {
    console.error("[openai-chat] Request failed:", err);
    return res.status(500).json({
      error: err.message || "OpenAI request failed",
    });
  }
};
