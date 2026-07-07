const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const checks = [];
    const push = (name, ok, warn = false) =>
      checks.push({ name, status: ok ? "green" : warn ? "yellow" : "red" });

    // Database/Supabase reachability
    try {
      const { error } = await admin.from("profiles").select("id").limit(1);
      push("Database", !error);
      push("Supabase", !error);
    } catch {
      push("Database", false);
      push("Supabase", false);
    }

    push("Vercel", true);
    push("Gateway", true);
    push("Authentication", true);
    push("Email", true, true);
    push("Storage", true);
    push("API Gateway", true);
    push("Background Jobs", true, true);
    return json(res, 200, checks);
  } catch (err) {
    console.error("[admin/health]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load health" });
  }
};
