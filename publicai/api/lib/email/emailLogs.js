const MAX_LOGS = 200;
const logs = [];

function appendEmailLog(entry) {
  const row = {
    id: `eml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  logs.unshift(row);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  console.log(`[email:log] ${row.template || "custom"} to=${row.to} provider=${row.provider}`);
  return row;
}

function getEmailLogs(limit = 50) {
  return logs.slice(0, Math.min(limit, MAX_LOGS));
}

module.exports = { appendEmailLog, getEmailLogs };
