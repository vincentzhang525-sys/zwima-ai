function statusPillClass(status) {
  if (status === "active" || status === "live") return "active";
  if (status === "coming_soon") return "planned";
  return "disabled";
}

document.addEventListener("DOMContentLoaded", async () => {
  const providerList = document.getElementById("providerList");
  if (!providerList) return;

  const cards = window.ZwimaModelCards?.getShowcaseCards?.() || [];
  if (!cards.length) {
    providerList.innerHTML = window.ZwimaEmpty?.render?.("No models available.") || "<p>No models available.</p>";
    return;
  }

  providerList.innerHTML = `<div class="model-cards-grid">${cards
    .map(
      (card) => `
    <article class="model-card">
      <div class="model-card-header">
        <div>
          <h2 style="margin:0;font-size:1.1rem;">${card.displayName}</h2>
          <p class="muted" style="margin:4px 0 0;">${card.providerName}</p>
        </div>
        <span class="status-pill ${statusPillClass(card.status)}">${card.statusLabel}</span>
      </div>
      <div class="model-card-meta">
        <div><span>Speed</span><strong>${card.speed}</strong></div>
        <div><span>Quality</span><strong>${card.quality}</strong></div>
        <div><span>Context</span><strong>${card.contextLength}</strong></div>
        <div><span>Price Level</span><strong>${card.priceLevel}</strong></div>
      </div>
      <p style="margin:0;font-size:0.92rem;"><span class="muted">Recommended:</span> ${card.recommendedUse}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <a class="button button-primary" href="playground.html?model=${encodeURIComponent(card.id)}">Test in Playground</a>
        <a class="button button-secondary" href="documentation.html">Docs</a>
      </div>
    </article>`
    )
    .join("")}</div>`;
});
