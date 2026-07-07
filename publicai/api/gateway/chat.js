const { getAdminClient, hashApiKey } = require("../lib/supabase");
const modelConfig = require("../../config/models.js");

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

function json(res, status, payload) {
  res.status(status).json(payload);
}

function detectTask(prompt) {
  const text = String(prompt || "").toLowerCase();
  if (/(code|debug|fix|refactor|function|typescript|javascript|python|sql)/.test(text)) {
    return "coding";
  }
  if (/(cheap|low cost|fast|quick|brief|short)/.test(text)) {
    return "fast";
  }
  if (/(explain|detailed|deep dive|step by step|long)/.test(text)) {
    return "long";
  }
  return "chat";
}

function chooseModel(prompt, explicitModel, routingMode = "intelligent") {
  if (explicitModel) return { modelId: modelConfig.resolveId(explicitModel), reason: "Explicit model selected." };
  if (routingMode === "manual") return { modelId: "gpt-4o", reason: "Manual mode default model." };

  const task = detectTask(prompt);
  if (task === "coding") return { modelId: "gpt-4.1", reason: "Coding task routed to GPT-4.1." };
  if (task === "fast") return { modelId: "gemini-2-flash", reason: "Low-cost / fast task routed to Gemini Flash." };
  if (task === "long") return { modelId: "gemini-2-pro", reason: "Long explanation routed to Gemini Pro." };
  return { modelId: "gpt-4o", reason: "General chat routed to GPT-4o." };
}

function modelPricing(modelId) {
  const model = modelConfig.getById(modelId);
  return {
    inputPrice: Number(model?.inputPrice) || 0,
    outputPrice: Number(model?.outputPrice) || 0,
  };
}

function estimatedCost(inputTokens, outputTokens, modelId) {
  const pricing = modelPricing(modelId);
  return Number(
    (((Number(inputTokens) || 0) * pricing.inputPrice + (Number(outputTokens) || 0) * pricing.outputPrice) / 1_000_000).toFixed(6)
  );
}

function buildGatewaySystem() {
  return "You are a helpful AI assistant on the ZWIMA API Gateway.";
}

async function callOpenAI(prompt, modelId, maxTokens) {
  const apiModel = modelConfig.resolveApiId(modelId);
  const payload = {
    model: apiModel,
    instructions: buildGatewaySystem(),
    input: String(prompt || ""),
    max_output_tokens: Number(maxTokens) || 1024,
    temperature: 0.7,
    store: false,
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
  }
  const content = String(data.output_text || "").trim();
  if (!content) throw new Error("OpenAI returned empty output.");
  const usage = {
    inputTokens: Number(data?.usage?.input_tokens) || 0,
    outputTokens: Number(data?.usage?.output_tokens) || 0,
    totalTokens: Number(data?.usage?.total_tokens) || 0,
  };
  return { content, usage };
}

async function callGemini(prompt, modelId, maxTokens) {
  const apiModel = modelConfig.resolveApiId(modelId);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildGatewaySystem() }] },
        contents: [{ role: "user", parts: [{ text: String(prompt || "") }] }],
        generationConfig: { maxOutputTokens: Number(maxTokens) || 1024, temperature: 0.7 },
      }),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed (${response.status})`);
  }
  const content = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!content) throw new Error("Gemini returned empty output.");
  const usage = {
    inputTokens: Number(data?.usageMetadata?.promptTokenCount) || 0,
    outputTokens: Number(data?.usageMetadata?.candidatesTokenCount) || 0,
    totalTokens: Number(data?.usageMetadata?.totalTokenCount) || 0,
  };
  return { content, usage };
}

async function runModel(prompt, modelId, maxTokens) {
  const provider = modelConfig.getById(modelId)?.provider;
  if (provider === "google") return { ...(await callGemini(prompt, modelId, maxTokens)), provider };
  return { ...(await callOpenAI(prompt, modelId, maxTokens)), provider: "openai" };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = parseBody(req);
  const apiKey = String(body.apiKey || "").trim();
  const prompt = String(body.prompt || "").trim();
  if (!apiKey) return json(res, 400, { error: "apiKey is required." });
  if (!prompt) return json(res, 400, { error: "prompt is required." });

  try {
    const admin = getAdminClient();
    const keyHash = hashApiKey(apiKey);
    const { data: keyRow, error: keyError } = await admin
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("status", "Active")
      .maybeSingle();
    if (keyError) throw keyError;
    if (!keyRow) return json(res, 401, { error: "Invalid API key." });

    const picked = chooseModel(prompt, body.model, body.routingMode);
    const started = Date.now();
    const result = await runModel(prompt, picked.modelId, body.maxTokens);
    const elapsedMs = Date.now() - started;

    const usage = {
      inputTokens: Number(result.usage.inputTokens) || 0,
      outputTokens: Number(result.usage.outputTokens) || 0,
      totalTokens: Number(result.usage.totalTokens) || 0,
    };
    const creditsToDeduct = Math.max(1, usage.totalTokens || usage.inputTokens + usage.outputTokens);
    const cost = estimatedCost(usage.inputTokens, usage.outputTokens, picked.modelId);

    const { data: walletRow, error: walletError } = await admin
      .from("credit_wallets")
      .select("*")
      .eq("user_id", keyRow.user_id)
      .maybeSingle();
    if (walletError) throw walletError;
    const currentBalance = Number(walletRow?.balance) || 0;
    if (currentBalance < creditsToDeduct) {
      return json(res, 402, { error: "Insufficient credits." });
    }
    const remaining = currentBalance - creditsToDeduct;

    const { error: walletUpdateError } = await admin
      .from("credit_wallets")
      .upsert({ user_id: keyRow.user_id, balance: remaining, currency: "EUR" });
    if (walletUpdateError) throw walletUpdateError;

    const { error: txError } = await admin.from("credit_transactions").insert({
      user_id: keyRow.user_id,
      type: "usage",
      amount: -creditsToDeduct,
      description: `Gateway ${picked.modelId} (${usage.totalTokens} tokens)`,
      txn_date: new Date().toISOString().slice(0, 10),
      status: "completed",
    });
    if (txError) throw txError;

    const { error: usageError } = await admin.from("usage_records").insert({
      user_id: keyRow.user_id,
      provider: result.provider === "google" ? "Google Gemini" : "OpenAI",
      model: modelConfig.getById(picked.modelId)?.displayName || picked.modelId,
      prompt,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      estimated_cost: cost,
      credits_deducted: creditsToDeduct,
      request_time_ms: elapsedMs,
      remaining_credits: remaining,
      status: "Success",
    });
    if (usageError) throw usageError;

    await admin
      .from("api_keys")
      .update({
        last_used: new Date().toISOString(),
        total_usage: (Number(keyRow.total_usage) || 0) + creditsToDeduct,
      })
      .eq("id", keyRow.id);

    return json(res, 200, {
      content: result.content,
      provider: result.provider === "google" ? "Google Gemini" : "OpenAI",
      model: modelConfig.getById(picked.modelId)?.displayName || picked.modelId,
      selectedModelId: picked.modelId,
      routingReason: picked.reason,
      estimatedCost: cost,
      usage,
      creditsDeducted: creditsToDeduct,
      remainingCredits: remaining,
      latencyMs: elapsedMs,
    });
  } catch (err) {
    console.error("[gateway/chat]", err);
    return json(res, err.status || 500, { error: err.message || "Gateway request failed" });
  }
};
