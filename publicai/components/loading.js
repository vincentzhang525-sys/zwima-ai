(function () {
  window.ZwimaLoading = {
    show(container, message) {
      if (!container) return;
      container.innerHTML = `<div class="zwima-loading">${message ? `<p>${message}</p>` : ""}<p class="zwima-skeleton" style="height:16px;margin:8px 0;"></p><p class="zwima-skeleton" style="height:16px;width:75%;"></p></div>`;
    },
    skeleton(rows) {
      return Array.from({ length: rows || 3 })
        .map(() => `<p class="zwima-skeleton" style="height:14px;margin:8px 0;"></p>`)
        .join("");
    },
    hide(container) {
      if (!container) return;
      const loading = container.querySelector(".zwima-loading");
      if (loading) loading.remove();
    },
  };
})();
