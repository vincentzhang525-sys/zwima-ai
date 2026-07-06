const { json, handleOptions, withCors } = require("./lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
  const enabled = Boolean(supabaseUrl && supabaseAnonKey);

  return json(res, 200, {
    authProvider: enabled ? "supabase" : "localStorage",
    dbDriver: enabled ? "supabase" : "mock",
    supabaseUrl,
    supabaseAnonKey,
  });
};
