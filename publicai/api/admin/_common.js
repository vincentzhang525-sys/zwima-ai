const { getAuthedClient, loadProfile, getAdminClient } = require("../lib/supabase");

async function requireAdmin(req) {
  const { client, user } = await getAuthedClient(req);
  const profile = await loadProfile(client, user.id);
  const role = String(profile?.role || "").toLowerCase();
  if (!["owner", "admin", "support"].includes(role)) {
    const err = new Error("Admin access required.");
    err.status = 403;
    throw err;
  }
  return { client, user, profile, admin: getAdminClient() };
}

function parsePaging(req, defaults = {}) {
  const page = Math.max(1, Number(req.query?.page) || defaults.page || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize) || defaults.pageSize || 20));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

module.exports = {
  requireAdmin,
  parsePaging,
};
