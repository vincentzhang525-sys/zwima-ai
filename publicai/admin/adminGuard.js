(function () {
  window.ZwimaAdminGuard = {
    requireAdmin() {
      if (!window.ZwimaAuthGuard?.isAuthenticated()) {
        window.location.href = "login.html?redirect=admin.html";
        return false;
      }
      const user = window.ZwimaJwtManager?.getUserFromAccessToken() || window.ZwimaUserService?.getSessionSync();
      const isAdmin = window.ZwimaPermissionManager?.hasRole(user, "Admin")
        || window.ZwimaPermissionManager?.hasRole(user, "Owner")
        || window.ZwimaPermissionManager?.hasRole(user, "Support");
      if (!isAdmin) {
        window.location.href = "dashboard.html";
        return false;
      }
      return true;
    },
  };
})();
