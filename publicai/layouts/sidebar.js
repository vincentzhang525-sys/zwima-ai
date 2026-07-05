(function () {
  const NAV_ORDER = [
    "dashboard",
    "models",
    "apikeys",
    "playground",
    "routing",
    "gateway",
    "credits",
    "usage",
    "billing",
    "settings",
    "documentation",
  ];

  window.ZwimaLayoutSidebar = {
    init(activePage) {
      const nav = document.querySelector(".sidebar-nav");
      if (!nav || !activePage || activePage === "dashboard") return;

      const pages = window.ZwimaConstants?.NAV_PAGES || {};
      const links = nav.querySelectorAll("a.sidebar-link");

      links.forEach((link) => {
        const href = link.getAttribute("href") || "";
        const matched = Object.entries(pages).some(([key, item]) => {
          if (key !== activePage) return false;
          return href === item.href || href.endsWith(item.href.replace("dashboard.html", ""));
        });
        link.classList.toggle("active", matched);
        if (matched) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    },
    getNavOrder() {
      return [...NAV_ORDER];
    },
  };
})();
