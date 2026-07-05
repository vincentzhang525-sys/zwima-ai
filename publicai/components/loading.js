(function () {
  window.ZwimaLoading = {
    show(container, message) {
      if (!container) return;
      container.innerHTML = `<p class="zwima-loading">${message || "Loading..."}</p>`;
    },
    hide(container) {
      if (!container) return;
      const loading = container.querySelector(".zwima-loading");
      if (loading) loading.remove();
    },
  };
})();
