async function loadStatus() {
  const grid = document.getElementById("statusGrid");
  const componentsGrid = document.getElementById("componentsGrid");
  const summary = document.getElementById("statusSummary");
  const checked = document.getElementById("statusCheckedAt");
  const incidentsEl = document.getElementById("statusIncidents");
  try {
    const res = await fetch("/api/status/public");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load status");
    summary.textContent =
      data.status === "operational"
        ? "All systems operational"
        : data.status === "degraded"
          ? "Some systems degraded"
          : "Major outage detected";
    checked.textContent = data.checkedAt ? `Last checked: ${new Date(data.checkedAt).toLocaleString("en-GB")}` : "";

    function card(name, status, latency, extra) {
      const pill =
        status === "operational"
          ? "active"
          : status === "offline"
            ? "failed"
            : "planned";
      return `<article class="status-provider-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <h2 style="margin:0;font-size:1.1rem;">${name}</h2>
          <span class="status-pill ${pill}">${status}</span>
        </div>
        <p class="muted" style="margin:8px 0;">Latency: ${latency || 0} ms ${extra || ""}</p>
      </article>`;
    }

    grid.innerHTML = (data.providers || [])
      .map(
        (p) => card(p.provider, p.operationalStatus || p.health, p.latencyMs, `· ${p.availabilityLabel} · Models: ${p.modelCount}`)
      )
      .join("");

    if (componentsGrid) {
      componentsGrid.innerHTML = (data.components || [])
        .map((c) => card(c.name, c.operationalStatus, c.latencyMs))
        .join("");
    }

    if (incidentsEl) {
      incidentsEl.innerHTML = (data.activeIncidents || []).length
        ? (data.activeIncidents || [])
            .map(
              (i) => `<article class="notice-box" style="margin-bottom:8px;"><strong>${i.title}</strong><p class="muted">${i.component} · ${i.impact}</p></article>`
            )
            .join("")
        : '<p class="muted">No active incidents. <a href="incidents.html">View history</a></p>';
    }
  } catch (err) {
    summary.textContent = "Unable to load provider status.";
    grid.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadStatus);
