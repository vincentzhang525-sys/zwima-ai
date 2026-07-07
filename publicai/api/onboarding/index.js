const { getAuthedClient, getAdminClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");

const STEPS = [
  "registered",
  "email_verified",
  "api_key_created",
  "credits_received",
  "playground_opened",
  "first_api_call",
  "plan_upgraded",
];

function defaultProgress(userId) {
  return {
    user_id: userId,
    registered: false,
    email_verified: false,
    api_key_created: false,
    credits_received: false,
    playground_opened: false,
    first_api_call: false,
    plan_upgraded: false,
    completed_at: null,
  };
}

function toResponse(row) {
  const steps = STEPS.map((key) => ({
    id: key,
    completed: !!row[key],
    label: key.replace(/_/g, " "),
  }));
  const completedCount = steps.filter((s) => s.completed).length;
  const percent = Math.round((completedCount / STEPS.length) * 100);
  return {
    steps,
    completedCount,
    totalSteps: STEPS.length,
    percent,
    completed: !!row.completed_at || completedCount === STEPS.length,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

async function ensureProgress(admin, userId, patch = {}) {
  const { data: existing } = await admin.from("onboarding_progress").select("*").eq("user_id", userId).maybeSingle();
  if (!existing) {
    const row = { ...defaultProgress(userId), registered: true, ...patch, updated_at: new Date().toISOString() };
    const { data } = await admin.from("onboarding_progress").insert(row).select().single();
    return data;
  }
  const next = { ...existing, ...patch, updated_at: new Date().toISOString() };
  const allDone = STEPS.every((k) => next[k]);
  if (allDone && !next.completed_at) next.completed_at = new Date().toISOString();
  const { data } = await admin.from("onboarding_progress").update(next).eq("user_id", userId).select().single();
  return data;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { user } = await getAuthedClient(req);
    const admin = getAdminClient();

    if (req.method === "GET") {
      const { data } = await admin.from("onboarding_progress").select("*").eq("user_id", user.id).maybeSingle();
      const row = data || { ...defaultProgress(user.id), registered: true };
      return json(res, 200, { onboarding: toResponse(row) });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const step = String(body.step || "").trim();
      if (!STEPS.includes(step)) return json(res, 400, { error: "Invalid onboarding step." });
      const row = await ensureProgress(admin, user.id, { [step]: true });
      return json(res, 200, { ok: true, onboarding: toResponse(row) });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[onboarding]", err);
    return json(res, err.status || 500, { error: err.message || "Onboarding request failed" });
  }
};

module.exports.ensureProgress = ensureProgress;
module.exports.STEPS = STEPS;
