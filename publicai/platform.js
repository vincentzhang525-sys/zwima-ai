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

    // Lightweight page lazy-loading helpers.
    document.querySelectorAll('img[data-src]').forEach((img) => {
      const apply = () => {
        if (!img.dataset.src) return;
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
      };
      if (!("IntersectionObserver" in window)) return apply();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          apply();
          io.disconnect();
        });
      });
      io.observe(img);
    });

    document.querySelectorAll("a[href$='.html']").forEach((link) => {
      link.addEventListener(
        "mouseenter",
        () => {
          const href = link.getAttribute("href");
          if (!href || href.startsWith("http")) return;
          const prefetch = document.createElement("link");
          prefetch.rel = "prefetch";
          prefetch.href = href;
          document.head.appendChild(prefetch);
        },
        { once: true }
      );
    });
  });
})();
