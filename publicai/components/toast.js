(function () {
  let container;

  function ensureContainer() {
    if (container) return container;
    container = document.createElement("div");
    container.id = "zwima-toast-container";
    container.className = "zwima-toast-container";
    document.body.appendChild(container);
    return container;
  }

  window.ZwimaToast = {
    show(message, type) {
      const root = ensureContainer();
      const toast = document.createElement("div");
      toast.className = `zwima-toast zwima-toast-${type || "info"}`;
      toast.textContent = message;
      root.appendChild(toast);
      setTimeout(() => toast.remove(), 3200);
    },
    success(message) {
      this.show(message, "success");
    },
    error(message) {
      this.show(message, "error");
    },
    info(message) {
      this.show(message, "info");
    },
  };
})();
