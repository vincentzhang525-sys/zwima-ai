(function () {
  window.ZwimaSession = {
    getSession() {
      return window.ZwimaUserService.getSessionSync();
    },
    saveSession(data) {
      return window.ZwimaUserService.saveSession(data);
    },
    clearSession() {
      return window.ZwimaUserService.clearSession();
    },
    renderTopbarUser() {
      window.ZwimaLayoutHeader.renderUser();
    },
    MOCK_USER_DEFAULT: null,
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (window.ZwimaLayoutHeader) {
      window.ZwimaLayoutHeader.renderUser();
    }
  });
})();
