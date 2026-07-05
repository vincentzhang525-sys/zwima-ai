(function () {
  function delay() {
    return new Promise((resolve) => {
      setTimeout(resolve, window.ZWIMA_CONFIG?.MOCK_DELAY_MS || 120);
    });
  }

  window.ZwimaModal = {
    open(id) {
      const el = document.getElementById(id);
      if (el) el.hidden = false;
    },
    close(id) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    },
    bindOverlayClose(overlayId) {
      const overlay = document.getElementById(overlayId);
      if (!overlay) return;
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) overlay.hidden = true;
      });
    },
  };
})();
