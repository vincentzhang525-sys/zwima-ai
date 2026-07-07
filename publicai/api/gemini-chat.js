const modelConfig = require("../config/models.js");
const { enforceRateLimit, getClientIp } = require("./lib/supabase");

function resolveModel(modelRef) {
  return modelConfig.resolveId(modelRef);
}

function resolveApiModel(modelId) {
  return modelConfig.resolveApiId(modelId);
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

function buildSystemInstruction(customInstructions) {
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
    "You are Gemini, a helpful AI assistant on the ZWIMA AI Playground.",
    `Current UTC time: ${utc}.`,
    `Current Asia/Shanghai time: ${local}.`,
    "Answer clearly and naturally in the same language the user uses.",
  ];

  if (customInstructions && String(customInstructions).trim()) {
    parts.unshift(String(customInstructions).trim());
  }

  return {
    parts: [{ text: parts.join("\n") }],
  };
}

function buildContents(messages, prompt) {
  const items = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: "user", content: String(prompt || "") }];

  return items
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.content || "") }],
    }));
}

function buildRequestBody(body) {
  const modelId = resolveModel(body.model);
  const apiModel = resolveApiModel(modelId);
  const maxTokens = Number(body.maxTokens) || 2048;
  const temperature = Number(body.temperature ?? 0.7);
  const contents = buildContents(body.messages, body.prompt);

  return {
    modelId,
    apiModel,
    requestBody: {
      systemInstruction: buildSystemInstruction(body.instructions),
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    },
  };
}

function mapUsage(usageMetadata) {
  const inputTokens = Number(usageMetadata?.promptTokenCount) || 0;
  const outputTokens = Number(usageMetadata?.candidatesTokenCount) || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usageMetadata?.totalTokenCount) || inputTokens + outputTokens,
  };
}

function extractText(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return "";
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part) => part.text)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

async function handleNonStream(req, res, body) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const { modelId, apiModel, requestBody } = buildRequestBody(body);
  const started = Date.now();

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  const json = await geminiRes.json().catch(() => ({}));

  if (!geminiRes.ok) {
    console.error("[gemini-chat] API error:", JSON.stringify(json, null, 2));
    return res.status(geminiRes.status).json({
      error: json?.error?.message || `Gemini API error ${geminiRes.status}`,
      details: json?.error || json,
    });
  }

  const content = extractText(json.candidates);
  if (!content) {
    console.error("[gemini-chat] Empty output:", JSON.stringify(json, null, 2));
    return res.status(502).json({
      error: "Gemini returned an empty response",
      details: json,
    });
  }

  return res.status(200).json({
    content,
    model: modelId,
    usage: mapUsage(json.usageMetadata),
    latencyMs: Date.now() - started,
  });
}

async function handleStream(req, res, body) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const { apiModel, requestBody } = buildRequestBody(body);

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!geminiRes.ok) {
    const json = await geminiRes.json().catch(() => ({}));
    console.error("[gemini-chat] Stream error:", JSON.stringify(json, null, 2));
    return res.status(geminiRes.status).json({
      error: json?.error?.message || `Gemini API error ${geminiRes.status}`,
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

  const reader = geminiRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (err) {
    console.error("[gemini-chat] Stream pipe failed:", err);
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

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API key not configured (GEMINI_API_KEY/GOOGLE_API_KEY)" });
  }

  const body = parseBody(req);

  try {
    const limiter = await enforceRateLimit({
      req,
      route: "playground:gemini",
      limit: 120,
      windowSeconds: 60,
      key: `gemini:${getClientIp(req)}`,
    });
    if (!limiter.allowed) {
      return res.status(429).json({ error: "Rate limit exceeded. Please retry shortly." });
    }
    if (body.stream) {
      return handleStream(req, res, body);
    }
    return handleNonStream(req, res, body);
  } catch (err) {
    console.error("[gemini-chat] Request failed:", err);
    return res.status(500).json({
      error: err.message || "Gemini request failed",
    });
  }
};
