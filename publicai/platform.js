(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;
    if (window.ZwimaLayoutSidebar && page) {
      window.ZwimaLayoutSidebar.init(page);
    }
    if (window.ZwimaLayoutHeader) {
      window.ZwimaLayoutHeader.init();
    }
    if (window.ZwimaLayoutFooter) {
      window.ZwimaLayoutFooter.init();
    }

    if (window.ZwimaDatabase) {
      await window.ZwimaDatabase.init().catch(() => {});
    }

    if (window.ZwimaAuthGuard) {
      await window.ZwimaAuthGuard.restoreSession();
      window.ZwimaAuthGuard.requireAuth();
    }

    if (window.ZwimaAuthService?.isAuthenticated()) {
      window.ZwimaJwtManager?.scheduleAutoRefresh(() => window.ZwimaAuthService.refreshToken());
    }

    if (window.ZwimaDatabase) {
      const repos = await window.ZwimaDatabase.repos().catch(() => null);
      repos?.gateway?.startHealthMonitor?.();
    }
  });
})();
