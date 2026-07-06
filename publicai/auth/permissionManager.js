(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaPermissionManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ROLES = ["admin", "customer", "Admin", "Owner", "Developer", "Viewer"];
  const PERMISSIONS = ["apikeys", "billing", "credits", "models", "gateway", "settings", "logs", "documentation"];

  const ROLE_PERMISSIONS = {
    admin: PERMISSIONS,
    customer: ["apikeys", "credits", "models", "gateway", "settings", "documentation"],
    Admin: PERMISSIONS,
    Owner: PERMISSIONS,
    Developer: ["apikeys", "models", "gateway", "logs", "documentation"],
    Viewer: ["models", "documentation", "logs"],
  };

  return {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    getPermissionsForRole(role) {
      return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Viewer;
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
      if (role === "admin") return true;
      return this.hasPermission(user, permission);
    },
  };
});
