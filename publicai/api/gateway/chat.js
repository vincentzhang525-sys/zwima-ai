const { getAdminClient, hashApiKey, enforceRateLimit, getClientIp, writeAuditLog } = require("../lib/supabase");
const { ensureProgress } = require("../onboarding/index.js");
const ledger = require("../lib/credits/ledger");
const modelRegistry = require("../../config/modelRegistry.js");
const universalRouter = require("../../gateway/universalRouter.js");

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
    const limiter = await enforceRateLimit({
      req,
      route: "gateway:chat",
      limit: 180,
      windowSeconds: 60,
      key: `gateway:${getClientIp(req)}`,
    });
    if (!limiter.allowed) return json(res, 429, { error: "Rate limit exceeded. Please retry shortly." });

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

    const started = Date.now();
    const result = await universalRouter.routeChat({
      provider: body.provider,
      model: body.model,
      prompt,
      systemPrompt: body.systemPrompt || universalRouter.defaultSystemPrompt,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      options: body.options || {},
      routingMode: body.routingMode,
    });
    const elapsedMs = Date.now() - started;

    const usage = result.usage;
    const creditsToDeduct = Math.max(1, usage.totalTokens || usage.inputTokens + usage.outputTokens);
    const cost = universalRouter.estimatedCost(usage.inputTokens, usage.outputTokens, result.model.id);
    const idempotencyKey = body.idempotencyKey
      ? `gateway:${String(body.idempotencyKey).slice(0, 120)}`
      : `gateway:${keyRow.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    let deductResult;
    try {
      deductResult = await ledger.deductAtomic(admin, {
        userId: keyRow.user_id,
        amount: creditsToDeduct,
        description: `Gateway ${result.model.id} (${usage.totalTokens} tokens)`,
        referenceType: "gateway",
        referenceId: result.model.id,
        idempotencyKey,
      });
    } catch (deductErr) {
      if (deductErr.status === 402) return json(res, 402, { error: deductErr.message });
      const rpcMissing = String(deductErr.message || "").includes("deduct_credits_atomic");
      if (!rpcMissing) throw deductErr;

      const { data: walletRow, error: walletError } = await admin
        .from("credit_wallets")
        .select("*")
        .eq("user_id", keyRow.user_id)
        .maybeSingle();
      if (walletError) throw walletError;
      const currentBalance = Number(walletRow?.balance) || 0;
      if (currentBalance < creditsToDeduct) return json(res, 402, { error: "Insufficient credits." });
      const remainingLegacy = currentBalance - creditsToDeduct;
      await admin.from("credit_wallets").upsert({ user_id: keyRow.user_id, balance: remainingLegacy, currency: "EUR" });
      const { data: legacyTxn } = await admin
        .from("credit_transactions")
        .insert({
          user_id: keyRow.user_id,
          type: "usage",
          amount: -creditsToDeduct,
          description: `Gateway ${result.model.id} (${usage.totalTokens} tokens)`,
          txn_date: new Date().toISOString().slice(0, 10),
          status: "completed",
        })
        .select("id")
        .single();
      deductResult = { balance: remainingLegacy, txnId: legacyTxn?.id, alreadyApplied: false };
    }
    const remaining = deductResult.balance;

    const { error: usageError } = await admin.from("usage_records").insert({
      user_id: keyRow.user_id,
      provider: "ZWIMA Gateway",
      model: result.model.displayName,
      prompt,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      estimated_cost: cost,
      credits_deducted: creditsToDeduct,
      request_time_ms: elapsedMs,
      remaining_credits: remaining,
      status: "Success",
      credit_transaction_id: deductResult.txnId || null,
    });
    if (usageError) throw usageError;

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
    return json(res, err.status || 500, { error: err.message || "Gateway request failed" });
  }
};
