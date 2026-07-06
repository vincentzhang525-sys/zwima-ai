const tableBody = document.getElementById("usageTableBody");
const filterProvider = document.getElementById("filterProvider");
const filterModel = document.getElementById("filterModel");

function escapeHtml(text) {
  return window.ZwimaFormat?.escapeHtml?.(text) ?? String(text);
}

function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function populateFilters() {
  const options = window.ZwimaUsageService.getFilterOptions();
  const providerValue = filterProvider?.value || "";
  const modelValue = filterModel?.value || "";

  if (filterProvider) {
    filterProvider.innerHTML =
      '<option value="">All Providers</option>' +
      options.providers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    filterProvider.value = providerValue;
  }

  if (filterModel) {
    filterModel.innerHTML =
      '<option value="">All Models</option>' +
      options.models.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    filterModel.value = modelValue;
  }
}

function renderTable() {
  if (!tableBody) return;

  const rows = window.ZwimaUsageService.getRecords({
    provider: filterProvider?.value || "",
    model: filterModel?.value || "",
  });

  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="10" class="muted">No usage records yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td class="muted">${escapeHtml(formatDateTime(row.dateTime))}</td>
          <td>${escapeHtml(row.provider)}</td>
          <td>${escapeHtml(row.model)}</td>
          <td class="muted prompt-cell" title="${escapeHtml(row.prompt)}">${escapeHtml(row.prompt)}</td>
          <td>${Number(row.inputTokens).toLocaleString()}</td>
          <td>${Number(row.outputTokens).toLocaleString()}</td>
          <td>${Number(row.totalTokens).toLocaleString()}</td>
          <td>€${Number(row.estimatedCost).toFixed(4)}</td>
          <td>${Number(row.remainingCredits).toLocaleString()}</td>
          <td><span class="status-pill active">${escapeHtml(row.status)}</span></td>
        </tr>
      `
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.ZwimaDbMode?.isSupabaseMode?.()) {
    await window.ZwimaUsageService?.refreshRecords?.();
  }
  populateFilters();
  renderTable();

  filterProvider?.addEventListener("change", renderTable);
  filterModel?.addEventListener("change", renderTable);
});
