const tableBody = document.getElementById("usageTableBody");
const filterProvider = document.getElementById("filterProvider");
const filterModel = document.getElementById("filterModel");
const filterStatus = document.getElementById("filterStatus");
const usageSearch = document.getElementById("usageSearch");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");

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
    status: filterStatus?.value || "",
    search: usageSearch?.value || "",
    dateFrom: dateFrom?.value || "",
    dateTo: dateTo?.value || "",
  });

  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="10" class="muted">No usage records yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.provider)}</td>
          <td>${escapeHtml(row.model)}</td>
          <td>${Number(row.inputTokens).toLocaleString()}</td>
          <td>${Number(row.outputTokens).toLocaleString()}</td>
          <td>${Number(row.totalTokens).toLocaleString()}</td>
          <td>${Number(row.creditsDeducted || row.totalTokens || 0).toLocaleString()}</td>
          <td>${Number(row.requestTimeMs || 0)} ms</td>
          <td>${escapeHtml(row.status || "Success")}</td>
          <td class="muted">${escapeHtml(formatDateTime(row.dateTime))}</td>
          <td class="muted prompt-cell" title="${escapeHtml(row.prompt)}">${escapeHtml(row.prompt)}</td>
        </tr>
      `
    )
    .join("");
}

async function refreshUsageFromServer() {
  if (!window.ZwimaDbMode?.isSupabaseMode?.()) return;
  await window.ZwimaUsageService?.refreshRecords?.({
    provider: filterProvider?.value || "",
    model: filterModel?.value || "",
    status: filterStatus?.value || "",
    search: usageSearch?.value || "",
    dateFrom: dateFrom?.value || "",
    dateTo: dateTo?.value || "",
  });
}

function exportCsv() {
  const rows = window.ZwimaUsageService.getRecords({
    provider: filterProvider?.value || "",
    model: filterModel?.value || "",
    status: filterStatus?.value || "",
    search: usageSearch?.value || "",
    dateFrom: dateFrom?.value || "",
    dateTo: dateTo?.value || "",
  });
  const header = [
    "provider",
    "model",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "credits",
    "latency_ms",
    "status",
    "created_time",
    "prompt",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const cols = [
      row.provider || "",
      row.model || "",
      row.inputTokens || 0,
      row.outputTokens || 0,
      row.totalTokens || 0,
      row.creditsDeducted || 0,
      row.requestTimeMs || 0,
      row.status || "Success",
      row.dateTime || "",
      row.prompt || "",
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
    await window.ZwimaUsageService?.refreshRecords?.({
      provider: filterProvider?.value || "",
      model: filterModel?.value || "",
      status: filterStatus?.value || "",
      search: usageSearch?.value || "",
      dateFrom: dateFrom?.value || "",
      dateTo: dateTo?.value || "",
    });
  }
  populateFilters();
  renderTable();

  const rerender = async () => {
    await refreshUsageFromServer();
    populateFilters();
    renderTable();
  };
  filterProvider?.addEventListener("change", rerender);
  filterModel?.addEventListener("change", rerender);
  filterStatus?.addEventListener("change", rerender);
  dateFrom?.addEventListener("change", rerender);
  dateTo?.addEventListener("change", rerender);
  usageSearch?.addEventListener("input", rerender);
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
