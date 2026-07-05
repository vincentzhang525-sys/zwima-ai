(function () {
  const PUBLIC_PAGES = ["auth.html", "login.html", "index.html"];

  function isPublicPage() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    return PUBLIC_PAGES.includes(path) || path === "";
  }

  window.ZwimaAuthGuard = {
    isAuthenticated() {
      const token = window.ZwimaJwtManager?.getAccessToken();
      if (!token) return false;
      return !window.ZwimaJwtManager.isExpired(token);
    },
    requireAuth() {
      if (isPublicPage()) return true;
      if (!document.body.classList.contains("dashboard-body") && !document.body.classList.contains("auth-module-body")) {
        return true;
      }
      if (document.body.classList.contains("auth-module-body")) return true;
      if (this.isAuthenticated()) return true;
      const redirect = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
      window.location.href = `auth.html?mode=signin&redirect=${redirect}`;
      return false;
    },
    async restoreSession() {
      if (!window.ZwimaAuthService) return null;
      if (this.isAuthenticated()) {
        const user = window.ZwimaJwtManager.getUserFromAccessToken();
        if (user) window.ZwimaStorage.set("SESSION", user);
        return user;
      }
      const refresh = window.ZwimaJwtManager?.getRefreshToken();
      if (!refresh || window.ZwimaJwtManager.isExpired(refresh)) return null;
      try {
        return await window.ZwimaAuthService.refreshToken();
      } catch {
        return null;
      }
    },
  };
})();
