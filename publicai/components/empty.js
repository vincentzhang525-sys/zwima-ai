(function () {
  window.ZwimaEmpty = {
    render(message) {
      return `<p class="zwima-empty">${message || "No data available."}</p>`;
    },
    renderRow(message, colspan) {
      return `<tr><td colspan="${colspan || 1}" class="muted">${message || "No data available."}</td></tr>`;
    },
  };
})();
