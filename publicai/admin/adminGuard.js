(function () {
  window.ZwimaAdminGuard = {
    requireAdmin() {
      if (!window.ZwimaAuthGuard?.isAuthenticated()) {
        window.location.href = "login.html?redirect=admin.html";
        return false;
      }
      const user = window.ZwimaJwtManager?.getUserFromAccessToken() || window.ZwimaUserService?.getSessionSync();
      if (!window.ZwimaPermissionManager?.hasRole(user, "Admin")) {
        window.location.href = "dashboard.html";
        return false;
      }
      return true;
    },
  };
})();
