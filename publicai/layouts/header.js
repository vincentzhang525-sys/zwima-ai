(function () {
  window.ZwimaLayoutHeader = {
    init() {
      this.renderUser();
    },
    renderUser() {
      const panel = document.getElementById("topbarUserPanel");
      if (!panel || !window.ZwimaUserService) return;

      const user = window.ZwimaUserService.getSessionSync();
      const initials = user.avatar || window.ZwimaFormat.getInitials(user.name);

      panel.innerHTML = `
        <a class="user-menu" href="auth.html?mode=profile">
          <span class="user-avatar" aria-hidden="true">${initials}</span>
          <span class="user-meta">
            <strong class="user-name">${window.ZwimaFormat.escapeHtml(user.name)}</strong>
            <span class="user-company-line">${window.ZwimaFormat.escapeHtml(user.company)}</span>
            <span class="user-plan-line">${window.ZwimaFormat.escapeHtml(user.plan)}</span>
          </span>
        </a>
      `;
    },
  };
})();
