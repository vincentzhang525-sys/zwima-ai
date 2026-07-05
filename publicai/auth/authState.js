(function (root) {
  const PROTECTED_PAGES = ["dashboard.html", "admin.html", "credits.html", "apikeys.html", "playground.html"];
  const AUTH_PAGES = ["login.html", "signup.html", "forgot-password.html", "verify-email.html"];

  function currentPage() {
    return (root.location.pathname.split("/").pop() || "index.html").split("?")[0];
  }

  function isAuthenticated() {
    if (root.ZwimaMockAuth?.isAuthenticated()) return true;
    if (root.ZwimaAuthGuard?.isAuthenticated()) return true;
    return false;
  }

  function redirect(url) {
    root.location.href = url;
  }

  root.ZwimaAuthState = {
    PROTECTED_PAGES,
    AUTH_PAGES,

    isAuthenticated,

    requireAuth() {
      const page = currentPage();
      if (!PROTECTED_PAGES.includes(page)) return true;
      if (isAuthenticated()) return true;
      const target = encodeURIComponent(page + root.location.search);
      redirect(`login.html?redirect=${target}`);
      return false;
    },

    redirectIfAuthenticated() {
      const page = currentPage();
      if (!AUTH_PAGES.includes(page)) return;
      if (!isAuthenticated()) return;
      redirect("dashboard.html");
    },

    logout() {
      root.ZwimaMockAuth?.signOut?.();
      root.ZwimaAuthService?.signOut?.().catch(() => {});
      redirect("index.html");
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
  });
})(typeof window !== "undefined" ? window : globalThis);
