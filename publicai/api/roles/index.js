const { getAuthedClient, getAdminClient, json, handleOptions, withCors } = require("../lib/supabase");
const workspace = require("../lib/workspace");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    await getAuthedClient(req);
    const admin = getAdminClient();
    const permMap = await workspace.loadRolePermissions(admin);
    return json(res, 200, {
      roles: workspace.ORG_ROLES,
      permissions: workspace.ORG_ROLES.map((role) => ({
        role,
        permissions: workspace.getPermissionsForRole(role, permMap[role]),
      })),
    });
  } catch (err) {
    console.error("[roles]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load roles" });
  }
};
