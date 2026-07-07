(function () {
  window.ZwimaEmpty = {
    render(message) {
      return `<div class="zwima-empty" style="padding:24px;text-align:center;color:var(--gray-600);">${message || "No data available."}</div>`;
    },
    renderRow(message, colspan) {
      return `<tr><td colspan="${colspan || 1}" class="muted zwima-empty">${message || "No data available."}</td></tr>`;
    },
  };
})();
