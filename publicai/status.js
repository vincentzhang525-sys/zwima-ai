async function loadStatus() {
  const grid = document.getElementById("statusGrid");
  const summary = document.getElementById("statusSummary");
  const checked = document.getElementById("statusCheckedAt");
  try {
    const res = await fetch("/api/status/public");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load status");
    summary.textContent = `Platform status: ${data.status === "operational" ? "All core providers operational" : "Some providers unavailable"}`;
    checked.textContent = data.checkedAt ? `Last checked: ${new Date(data.checkedAt).toLocaleString("en-GB")}` : "";
    grid.innerHTML = (data.providers || [])
      .map(
        (p) => `<article class="status-provider-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <h2 style="margin:0;font-size:1.1rem;">${p.provider}</h2>
          <span class="status-pill ${p.availability === "live" ? "active" : "planned"}">${p.availabilityLabel}</span>
        </div>
        <p class="muted" style="margin:8px 0;">Health: ${p.healthLabel} · Latency: ${p.latencyMs || 0} ms · Models: ${p.modelCount}</p>
        <p style="margin:0;font-size:0.9rem;">${(p.models || []).slice(0, 3).map((m) => m.displayName).join(", ")}${p.modelCount > 3 ? "…" : ""}</p>
      </article>`
      )
      .join("");
  } catch (err) {
    summary.textContent = "Unable to load provider status.";
    grid.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadStatus);
