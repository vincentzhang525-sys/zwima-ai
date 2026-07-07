const Anthropic = require("@anthropic-ai/sdk");
const modelConfig = require("../config/models.js");

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
    "You are Claude, a helpful AI assistant on the ZWIMA AI Playground.",
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

function mapUsage(usage) {
  const inputTokens = Number(usage?.input_tokens) || 0;
  const outputTokens = Number(usage?.output_tokens) || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function extractText(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return "";
  return contentBlocks
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  const body = parseBody(req);
  const modelId = resolveModel(body.model);
  const apiModel = resolveApiModel(modelId);
  const maxTokens = Number(body.maxTokens) || 2048;
  const temperature = Number(body.temperature ?? 0.7);
  const messages = buildMessages(body.messages, body.prompt);
  const started = Date.now();

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: apiModel,
      max_tokens: maxTokens,
      temperature,
      system: buildSystem(body.instructions),
      messages,
    });

    const content = extractText(response.content);
    if (!content) {
      console.error("[anthropic-chat] Empty output:", JSON.stringify(response, null, 2));
      return res.status(502).json({
        error: "Anthropic returned an empty response",
        details: response,
      });
    }

    const usage = mapUsage(response.usage);

    return res.status(200).json({
      content,
      model: modelId,
      usage,
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    console.error("[anthropic-chat] Request failed:", err);
    const statusCode = Number(err?.status) || 500;
    return res.status(statusCode).json({
      error: err.message || "Anthropic request failed",
      details: err?.error || undefined,
    });
  }
};
