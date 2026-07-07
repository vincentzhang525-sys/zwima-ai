const { json, handleOptions, withCors } = require("../lib/supabase");
const { getEmailLogs } = require("../lib/email/emailLogs");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const limit = Math.min(100, Number(req.query?.limit) || 50);
  const logs = await getEmailLogs(limit);
  return json(res, 200, {
    logs,
    count: logs.length,
    note: "Transactional email logs (persisted). Mass sending disabled.",
  });
};
