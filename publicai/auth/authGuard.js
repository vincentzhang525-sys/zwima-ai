(function () {
  const PUBLIC_PAGES = [
    "auth.html",
    "login.html",
    "signup.html",
    "forgot-password.html",
    "verify-email.html",
    "index.html",
    "about.html",
    "pricing.html",
    "contact.html",
    "impressum.html",
    "privacy.html",
    "terms.html",
  ];

  function currentPage() {
    return (window.location.pathname.split("/").pop() || "index.html").split("?")[0];
  }

  function isPublicPage() {
    const path = currentPage();
    return PUBLIC_PAGES.includes(path) || path === "";
  }

  window.ZwimaAuthGuard = {
    isAuthenticated() {
      return window.ZwimaAuthService?.isAuthenticated() || false;
    },
    requireAuth() {
      const protectedPages = window.ZwimaAuthService?.PROTECTED_PAGES || [];
      const page = currentPage();
      if (protectedPages.includes(page)) {
        return window.ZwimaAuthService.requireAuth();
      }
      if (isPublicPage()) return true;
      if (!document.body.classList.contains("dashboard-body") && !document.body.classList.contains("auth-module-body")) {
        return true;
      }
      if (document.body.classList.contains("auth-module-body")) return true;
      if (this.isAuthenticated()) return true;
      return window.ZwimaAuthService.requireAuth();
    },
    async restoreSession() {
      if (!window.ZwimaAuthService) return null;
      if (this.isAuthenticated()) {
        const user = window.ZwimaAuthService.getCurrentUser();
        if (user) window.ZwimaStorage?.set("SESSION", user);
        return user;
      }
      if (window.ZWIMA_CONFIG?.AUTH_PROVIDER === "api") {
        const refresh = window.ZwimaJwtManager?.getRefreshToken();
        if (!refresh || window.ZwimaJwtManager.isExpired(refresh)) return null;
        try {
          return await window.ZwimaAuthService.refreshToken();
        } catch {
          return null;
        }
      }
      return null;
    },
  };
})();
