const DEFAULT_ROLE_PERMISSIONS = {
  owner: ["apikeys", "billing", "credits", "models", "gateway", "playground", "usage", "logs", "members", "teams", "settings", "admin"],
  admin: ["apikeys", "billing", "credits", "models", "gateway", "playground", "usage", "logs", "members", "teams", "settings"],
  manager: ["apikeys", "credits", "models", "gateway", "playground", "usage", "logs", "teams", "members"],
  developer: ["apikeys", "credits", "models", "gateway", "playground", "usage", "logs"],
  viewer: ["models", "usage", "logs", "playground"],
};

const ORG_ROLES = ["owner", "admin", "manager", "developer", "viewer"];

const DEFAULT_TEAMS = ["Sales", "Engineering", "Marketing", "Finance", "Support"];

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPermissionsForRole(role, dbPermissions) {
  if (dbPermissions && Array.isArray(dbPermissions)) return dbPermissions;
  return DEFAULT_ROLE_PERMISSIONS[String(role || "viewer").toLowerCase()] || DEFAULT_ROLE_PERMISSIONS.viewer;
}

function hasPermission(role, permission, dbPermissions) {
  const perms = getPermissionsForRole(role, dbPermissions);
  return perms.includes(permission) || perms.includes("admin");
}

function canManageMembers(role) {
  return hasPermission(role, "members");
}

function canManageTeams(role) {
  return hasPermission(role, "teams");
}

function isOrgAdminRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

function generateInviteToken() {
  const crypto = require("crypto");
  return crypto.randomBytes(24).toString("hex");
}

async function loadRolePermissions(admin) {
  const { data } = await admin.from("workspace_role_permissions").select("*");
  const map = {};
  (data || []).forEach((row) => {
    map[row.role] = Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions || "[]");
  });
  return map;
}

async function getMemberRole(admin, organizationId, userId) {
  const { data: org } = await admin.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
  if (org?.owner_id === userId) return { role: "owner", status: "active" };
  const { data: member } = await admin
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return member;
}

async function requireOrgAccess(admin, organizationId, userId, permission) {
  const member = await getMemberRole(admin, organizationId, userId);
  if (!member || member.status === "suspended") {
    const err = new Error("Not a member of this organization");
    err.status = 403;
    throw err;
  }
  const permMap = await loadRolePermissions(admin);
  const dbPerms = permMap[member.role];
  if (permission && !hasPermission(member.role, permission, dbPerms)) {
    const err = new Error("Insufficient permissions");
    err.status = 403;
    throw err;
  }
  return { member, permissions: getPermissionsForRole(member.role, dbPerms) };
}

async function recordActivity(admin, { organizationId, userId, action, detail }) {
  await admin.from("member_activity").insert({
    organization_id: organizationId,
    user_id: userId,
    action,
    detail: detail || "",
  });
}

module.exports = {
  DEFAULT_ROLE_PERMISSIONS,
  ORG_ROLES,
  DEFAULT_TEAMS,
  slugify,
  getPermissionsForRole,
  hasPermission,
  canManageMembers,
  canManageTeams,
  isOrgAdminRole,
  generateInviteToken,
  loadRolePermissions,
  getMemberRole,
  requireOrgAccess,
  recordActivity,
};
