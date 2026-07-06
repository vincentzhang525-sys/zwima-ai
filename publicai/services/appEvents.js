(function () {
  const CHANNEL = "zwima:data-updated";

  window.ZwimaAppEvents = {
    emit(type, detail = {}) {
      const payload = { type, ...detail, at: Date.now() };
      window.dispatchEvent(new CustomEvent(CHANNEL, { detail: payload }));
      try {
        localStorage.setItem(CHANNEL, JSON.stringify(payload));
        localStorage.removeItem(CHANNEL);
      } catch {
        /* storage unavailable */
      }
    },

    onUpdated(handler) {
      window.addEventListener(CHANNEL, (event) => handler(event.detail || {}));
      window.addEventListener("storage", (event) => {
        if (event.key !== CHANNEL || !event.newValue) return;
        try {
          handler(JSON.parse(event.newValue));
        } catch {
          /* ignore */
        }
      });
    },
  };
})();
