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

  const PROTECTED_PAGES = ["dashboard.html", "admin.html", "credits.html", "apikeys.html", "playground.html"];

  function currentPage() {
    return (window.location.pathname.split("/").pop() || "index.html").split("?")[0];
  }

  function isPublicPage() {
    const path = currentPage();
    return PUBLIC_PAGES.includes(path) || path === "";
  }

  window.ZwimaAuthGuard = {
    isAuthenticated() {
      if (window.ZwimaMockAuth?.isAuthenticated()) return true;
      const token = window.ZwimaJwtManager?.getAccessToken();
      if (!token) return false;
      return !window.ZwimaJwtManager.isExpired(token);
    },
    requireAuth() {
      const page = currentPage();
      if (PROTECTED_PAGES.includes(page)) {
        if (this.isAuthenticated()) return true;
        const redirect = encodeURIComponent(page + window.location.search);
        window.location.href = `login.html?redirect=${redirect}`;
        return false;
      }
      if (isPublicPage()) return true;
      if (!document.body.classList.contains("dashboard-body") && !document.body.classList.contains("auth-module-body")) {
        return true;
      }
      if (document.body.classList.contains("auth-module-body")) return true;
      if (this.isAuthenticated()) return true;
      const redirect = encodeURIComponent(page + window.location.search);
      window.location.href = `login.html?redirect=${redirect}`;
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
