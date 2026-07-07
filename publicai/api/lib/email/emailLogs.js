const MAX_LOGS = 200;
const logs = [];

function mapAuditRow(row) {
  let detail = {};
  try {
    detail = JSON.parse(row.detail || "{}");
  } catch {
    detail = {};
  }
  return {
    id: row.id,
    at: detail.at || row.created_at,
    template: row.action,
    to: row.target,
    provider: detail.provider,
    status: detail.status,
    subject: detail.subject,
    messageId: detail.messageId,
  };
}

async function persistEmailLog(row) {
  try {
    const { getAdminClient } = require("../supabase");
    const admin = getAdminClient();
    await admin.from("audit_logs").insert({
      event_type: "email",
      action: row.template || "send",
      target: row.to,
      detail: JSON.stringify({
        provider: row.provider,
        status: row.status,
        subject: row.subject,
        messageId: row.messageId,
        at: row.at,
      }),
    });
  } catch (err) {
    console.warn("[email:log] persist failed", err.message);
  }
}

async function appendEmailLog(entry) {
  const row = {
    id: `eml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  logs.unshift(row);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  console.log(`[email:log] ${row.template || "custom"} to=${row.to} provider=${row.provider}`);
  await persistEmailLog(row);
  return row;
}

async function getEmailLogs(limit = 50) {
  const cap = Math.min(limit, MAX_LOGS);
  try {
    const { getAdminClient } = require("../supabase");
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("audit_logs")
      .select("*")
      .eq("event_type", "email")
      .order("created_at", { ascending: false })
      .limit(cap);
    if (!error && data?.length) {
      return data.map(mapAuditRow);
    }
  } catch (err) {
    console.warn("[email:log] read failed", err.message);
  }
  return logs.slice(0, cap);
}

module.exports = { appendEmailLog, getEmailLogs };
