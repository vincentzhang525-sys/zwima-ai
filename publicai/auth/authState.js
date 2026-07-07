(function (root) {
  const AUTH_PAGES = ["login.html", "signup.html", "forgot-password.html", "verify-email.html"];

  function currentPage() {
    return (root.location.pathname.split("/").pop() || "index.html").split("?")[0];
  }

  function isAuthenticated() {
    return root.ZwimaAuthService?.isAuthenticated() || false;
  }

  function redirect(url) {
    root.location.href = url;
  }

  let idleTimer = null;
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

  function markActivity() {
    if (!isAuthenticated()) return;
    if (root.ZwimaSessionManager?.isRememberLogin?.()) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      root.ZwimaAuthService?.logout?.().finally(() => redirect("login.html?reason=idle-timeout"));
    }, IDLE_TIMEOUT_MS);
  }

  function bindIdleTimeout() {
    ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((eventName) => {
      root.addEventListener(eventName, markActivity, { passive: true });
    });
    markActivity();
  }

  function bindTokenRefresh() {
    const runner = () => root.ZwimaAuthService?.refreshToken?.().catch?.(() => {});
    root.ZwimaJwtManager?.scheduleAutoRefresh?.(runner);
  }

  root.ZwimaAuthState = {
    AUTH_PAGES,

    isAuthenticated,

    requireAuth() {
      return root.ZwimaAuthService?.requireAuth() ?? true;
    },

    redirectIfAuthenticated() {
      const page = currentPage();
      if (!AUTH_PAGES.includes(page)) return;
      if (!isAuthenticated()) return;
      redirect("dashboard.html");
    },

    logout() {
      root.ZwimaAuthService?.logout?.().finally(() => redirect("index.html"));
    },

    renderSiteNav() {
      const nav = root.document.querySelector(".nav-menu");
      if (!nav) return;

      const loginLink = nav.querySelector('a[href="login.html"]');
      const dashboardLink = nav.querySelector('a[href="dashboard.html"]');
      let logoutLink = nav.querySelector("[data-auth-logout]");

      if (isAuthenticated()) {
        if (loginLink) loginLink.remove();
        if (dashboardLink) dashboardLink.style.display = "";
        if (!logoutLink) {
          logoutLink = root.document.createElement("a");
          logoutLink.href = "#";
          logoutLink.dataset.authLogout = "1";
          logoutLink.textContent = "Logout";
          const cta = nav.querySelector(".nav-cta");
          nav.insertBefore(logoutLink, cta || null);
          logoutLink.addEventListener("click", (event) => {
            event.preventDefault();
            root.ZwimaAuthState.logout();
          });
        }
      } else {
        if (dashboardLink) dashboardLink.remove();
        if (logoutLink) logoutLink.remove();
      }
    },
  };

  root.document?.addEventListener("DOMContentLoaded", () => {
    root.ZwimaAuthState.redirectIfAuthenticated();
    root.ZwimaAuthState.renderSiteNav();
    bindIdleTimeout();
    bindTokenRefresh();
  });
})(typeof window !== "undefined" ? window : globalThis);
