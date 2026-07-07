const tableBody = document.getElementById("usageTableBody");
const filterProvider = document.getElementById("filterProvider");
const filterModel = document.getElementById("filterModel");
const usageSearch = document.getElementById("usageSearch");

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
    search: usageSearch?.value || "",
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
          <td>${Number(row.creditsDeducted || row.totalTokens || 0).toLocaleString()}</td>
          <td>€${Number(row.estimatedCost || 0).toFixed(4)}</td>
          <td>${Number(row.requestTimeMs || 0)} ms</td>
        </tr>
      `
    )
    .join("");
}

function exportCsv() {
  const rows = window.ZwimaUsageService.getRecords({
    provider: filterProvider?.value || "",
    model: filterModel?.value || "",
    search: usageSearch?.value || "",
  });
  const header = [
    "date_time",
    "provider",
    "model",
    "prompt",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "credits_deducted",
    "cost_per_request_eur",
    "request_time_ms",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const cols = [
      row.dateTime || "",
      row.provider || "",
      row.model || "",
      row.prompt || "",
      row.inputTokens || 0,
      row.outputTokens || 0,
      row.totalTokens || 0,
      row.creditsDeducted || 0,
      Number(row.estimatedCost || 0).toFixed(6),
      row.requestTimeMs || 0,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
    lines.push(cols.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `usage-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.ZwimaDbMode?.isSupabaseMode?.()) {
    await window.ZwimaUsageService?.refreshRecords?.();
  }
  populateFilters();
  renderTable();

  filterProvider?.addEventListener("change", renderTable);
  filterModel?.addEventListener("change", renderTable);
  usageSearch?.addEventListener("input", renderTable);
  document.getElementById("exportUsageCsv")?.addEventListener("click", exportCsv);

  window.ZwimaAppEvents?.onUpdated?.((detail) => {
    if (detail.source !== "playground" && detail.source !== "usage") return;
    const refresh = window.ZwimaDbMode?.isSupabaseMode?.()
      ? window.ZwimaUsageService.refreshRecords()
      : Promise.resolve();
    refresh.then(() => {
      populateFilters();
      renderTable();
    });
  });
});
