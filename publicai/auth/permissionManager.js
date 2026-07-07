(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaPermissionManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ROLES = ["owner", "admin", "support", "customer", "Owner", "Admin", "Support"];
  const ORG_ROLES = ["owner", "admin", "manager", "developer", "viewer"];
  const PERMISSIONS = ["apikeys", "billing", "credits", "models", "gateway", "settings", "logs", "documentation", "playground", "usage", "members", "teams"];

  const ROLE_PERMISSIONS = {
    admin: PERMISSIONS,
    customer: ["apikeys", "credits", "models", "gateway", "settings", "documentation"],
    Admin: PERMISSIONS,
    owner: PERMISSIONS,
    admin: PERMISSIONS,
    support: ["apikeys", "credits", "usage", "documentation", "logs"],
    customer: ["apikeys", "credits", "models", "gateway", "settings", "documentation"],
    Owner: PERMISSIONS,
    Admin: PERMISSIONS,
    Support: ["apikeys", "credits", "usage", "documentation", "logs"],
  };

  const ORG_ROLE_PERMISSIONS = {
    owner: PERMISSIONS.concat(["members", "teams", "admin"]),
    admin: PERMISSIONS.concat(["members", "teams"]),
    manager: ["apikeys", "credits", "models", "gateway", "playground", "usage", "logs", "teams", "members"],
    developer: ["apikeys", "credits", "models", "gateway", "playground", "usage", "logs"],
    viewer: ["models", "usage", "logs", "playground"],
  };

  return {
    ROLES,
    ORG_ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    ORG_ROLE_PERMISSIONS,
    getPermissionsForRole(role) {
      return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.customer;
    },
    getOrgPermissionsForRole(role) {
      return ORG_ROLE_PERMISSIONS[String(role || "viewer").toLowerCase()] || ORG_ROLE_PERMISSIONS.viewer;
    },
    hasRole(user, role) {
      return String(user?.role || "").toLowerCase() === String(role).toLowerCase();
    },
    hasPermission(user, permission) {
      const perms = user?.permissions || this.getPermissionsForRole(user?.role);
      return perms.includes(permission);
    },
    canAccess(user, permission) {
      if (!user) return false;
      const role = String(user.role || "").toLowerCase();
      if (role === "admin" || role === "owner") return true;
      return this.hasPermission(user, permission);
    },
  };
});
