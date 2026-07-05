(function () {
  window.ZwimaTable = {
    render(tbody, rows, rowRenderer, emptyMessage) {
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = window.ZwimaEmpty.renderRow(emptyMessage || "No data available.", rowRenderer.colspan || 1);
        return;
      }
      tbody.innerHTML = rows.map(rowRenderer).join("");
    },
  };
})();
