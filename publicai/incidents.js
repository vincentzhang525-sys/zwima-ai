function pill(status) {
  const map = { operational: "active", degraded: "planned", maintenance: "planned", offline: "failed", resolved: "active", investigating: "planned" };
  return `<span class="status-pill ${map[status] || "planned"}">${status}</span>`;
}

async function loadIncidents() {
  const res = await fetch("/api/incidents");
  const data = await res.json();
  document.getElementById("incidentSummary").textContent =
    data.active?.length ? `${data.active.length} active incident(s)` : "No active incidents";

  document.getElementById("activeIncidents").innerHTML = (data.active || [])
    .map(
      (i) => `<article class="notice-box" style="margin-bottom:12px;border-left:4px solid #f59e0b;">
      <h3 style="margin:0 0 8px;">${i.title}</h3>
      <p class="muted">${i.component} · ${pill(i.impact)} · ${pill(i.incidentStatus)}</p>
      <p style="margin:8px 0 0;">${i.description || ""}</p>
    </article>`
    )
    .join("") || '<p class="muted">All systems normal.</p>';

  const body = document.getElementById("incidentBody");
  const rows = data.history || [];
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="muted">No incidents recorded.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map(
      (i) => `<tr>
      <td>${i.component}</td><td>${i.title}</td><td>${pill(i.impact)}</td>
      <td>${pill(i.incidentStatus)}</td>
      <td>${new Date(i.startsAt).toLocaleString("en-GB")}</td>
      <td>${i.resolvedAt ? new Date(i.resolvedAt).toLocaleString("en-GB") : "—"}</td>
    </tr>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", loadIncidents);
