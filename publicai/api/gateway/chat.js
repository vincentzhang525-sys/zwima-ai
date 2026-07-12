const { getAdminClient, hashApiKey, enforceRateLimit, getClientIp, writeAuditLog } = require("../lib/supabase");
const { ensureProgress } = require("../onboarding/index.js");
const ledger = require("../lib/credits/ledger");
const modelRegistry = require("../../config/modelRegistry.js");
const universalRouter = require("../../gateway/universalRouter.js");
const { sendTransactional } = require("../lib/email");

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

async function logGatewayRequest(admin, row) {
  try {
    await admin.from("gateway_request_logs").insert(row);
  } catch (err) {
    console.error("[gateway/chat] log", err.message);
  }
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
  const stream = Boolean(body.stream);
  if (!apiKey) return json(res, 400, { error: "apiKey is required." });
  if (!prompt) return json(res, 400, { error: "prompt is required." });

  const admin = getAdminClient();
  let keyRow = null;

  try {
    const limiter = await enforceRateLimit({
      req,
      route: "gateway:chat",
      limit: 180,
      windowSeconds: 60,
      key: `gateway:${getClientIp(req)}`,
    });
    if (!limiter.allowed) return json(res, 429, { error: "Rate limit exceeded. Please retry shortly." });

    const keyHash = hashApiKey(apiKey);
    const { data: keyData, error: keyError } = await admin
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("status", "Active")
      .maybeSingle();
    if (keyError) throw keyError;
    if (!keyData) return json(res, 401, { error: "Invalid API key." });
    keyRow = keyData;

    const userLimiter = await enforceRateLimit({
      req,
      route: "gateway:user",
      limit: 60,
      windowSeconds: 60,
      key: `gateway:user:${keyRow.user_id}`,
    });
    if (!userLimiter.allowed) return json(res, 429, { error: "Concurrent request limit reached. Please retry." });

    const maxTokens = Number(body.maxTokens) || 1024;
    const holdCredits = Math.max(1, maxTokens);
    const idempotencyKey = body.idempotencyKey
      ? `gateway:${String(body.idempotencyKey).slice(0, 120)}`
      : `gateway:hold:${keyRow.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    let holdResult;
    try {
      holdResult = await ledger.deductAtomic(admin, {
        userId: keyRow.user_id,
        amount: holdCredits,
        description: `Gateway hold (${holdCredits} credits)`,
        referenceType: "gateway_hold",
        referenceId: keyRow.id,
        idempotencyKey,
      });
    } catch (deductErr) {
      if (deductErr.status === 402) return json(res, 402, { error: deductErr.message });
      throw deductErr;
    }

    const started = Date.now();
    let result;
    let routeInfo = {};
    try {
      result = await universalRouter.routeChat({
        provider: body.provider,
        model: body.model,
        prompt,
        systemPrompt: body.systemPrompt || universalRouter.defaultSystemPrompt,
        temperature: body.temperature,
        maxTokens,
        options: body.options || {},
        routingMode: body.routingMode || "intelligent",
        regionPolicy: body.regionPolicy || process.env.GATEWAY_REGION_POLICY || "eu_preferred",
      });
      routeInfo = result;
    } catch (routeErr) {
      await ledger.creditAtomic(admin, {
        userId: keyRow.user_id,
        amount: holdCredits,
        type: "refund",
        description: "Gateway hold release (provider error)",
        referenceType: "gateway_hold",
        referenceId: keyRow.id,
        idempotencyKey: `${idempotencyKey}:release`,
      });
      await logGatewayRequest(admin, {
        user_id: keyRow.user_id,
        api_key_id: keyRow.id,
        provider: body.provider || "unknown",
        model: body.model || "unknown",
        status: "error",
        credits_deducted: 0,
        latency_ms: Date.now() - started,
        error_message: routeErr.message,
        region_policy: body.regionPolicy || "eu_preferred",
      });
      throw routeErr;
    }

    const elapsedMs = Date.now() - started;
    const usage = result.usage;
    const creditsToDeduct = Math.max(1, usage.totalTokens || usage.inputTokens + usage.outputTokens);
    const cost = universalRouter.estimatedCost(usage.inputTokens, usage.outputTokens, result.model.id);
    const settleKey = `${idempotencyKey}:settle`;

    let remaining = holdResult.balance;
    if (creditsToDeduct > holdCredits) {
      const extra = creditsToDeduct - holdCredits;
      const extraResult = await ledger.deductAtomic(admin, {
        userId: keyRow.user_id,
        amount: extra,
        description: `Gateway settlement +${extra}`,
        referenceType: "gateway",
        referenceId: result.model.id,
        idempotencyKey: settleKey,
      });
      remaining = extraResult.balance;
    } else if (creditsToDeduct < holdCredits) {
      const refund = holdCredits - creditsToDeduct;
      const refundResult = await ledger.creditAtomic(admin, {
        userId: keyRow.user_id,
        amount: refund,
        type: "refund",
        description: `Gateway hold release (${refund} credits)`,
        referenceType: "gateway",
        referenceId: result.model.id,
        idempotencyKey: `${settleKey}:refund`,
      });
      remaining = refundResult.balance;
    }

    const { error: usageError } = await admin.from("usage_records").insert({
      user_id: keyRow.user_id,
      provider: result.model?.provider || "ZWIMA Gateway",
      model: result.model.displayName,
      prompt: prompt.slice(0, 2000),
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

    await logGatewayRequest(admin, {
      user_id: keyRow.user_id,
      api_key_id: keyRow.id,
      provider: routeInfo.providerId || body.provider || "gateway",
      model: result.model.id,
      status: "success",
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      credits_deducted: creditsToDeduct,
      estimated_cost: cost,
      latency_ms: elapsedMs,
      region_policy: body.regionPolicy || "eu_preferred",
    });

    await admin
      .from("api_keys")
      .update({
        last_used: new Date().toISOString(),
        total_usage: (Number(keyRow.total_usage) || 0) + creditsToDeduct,
        total_requests: (Number(keyRow.total_requests) || 0) + 1,
      })
      .eq("id", keyRow.id);

    await writeAuditLog({
      userId: keyRow.user_id,
      eventType: "gateway",
      action: "gateway_chat",
      target: result.model.id,
      detail: `Gateway request processed. credits=${creditsToDeduct}`,
      ip: getClientIp(req),
    });

    try {
      await ensureProgress(admin, keyRow.user_id, { first_api_call: true });
    } catch (onbErr) {
      console.error("[gateway/chat] onboarding", onbErr);
    }

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.write(`data: ${JSON.stringify({ content: result.content, done: false })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, usage, creditsDeducted: creditsToDeduct, remainingCredits: remaining })}\n\n`);
      return res.end();
    }

    return json(res, 200, {
      content: result.content,
      model: result.model.displayName,
      modelId: result.model.id,
      routingReason: result.routingReason,
      fallbackReason: result.fallbackReason || null,
      estimatedCost: cost,
      usage,
      creditsDeducted: creditsToDeduct,
      remainingCredits: remaining,
      latencyMs: result.latencyMs || elapsedMs,
      finishReason: result.finishReason,
    });
  } catch (err) {
    console.error("[gateway/chat]", err);
    if (keyRow) {
      await logGatewayRequest(admin, {
        user_id: keyRow.user_id,
        api_key_id: keyRow.id,
        provider: body.provider || "unknown",
        model: body.model || "unknown",
        status: "error",
        latency_ms: 0,
        error_message: err.message,
      });
    }
    return json(res, err.status || 500, { error: err.message || "Gateway request failed" });
  }
};
