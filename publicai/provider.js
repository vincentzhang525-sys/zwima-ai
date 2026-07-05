document.addEventListener("DOMContentLoaded", async () => {
  const provider = await window.ZwimaProviderService.getProviderFromQuery();
  const fmt = window.ZwimaFormat;

  document.title = `${provider.name} | ZWIMA AI`;

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const container = document.getElementById("providerDetail");

  if (pageTitle) pageTitle.textContent = provider.name;
  if (pageSubtitle) pageSubtitle.textContent = provider.description;
  if (!container) return;

  const modelCards = provider.models
    .map(
      (model) => `
        <article class="detail-model-card">
          <h3>${model.name}</h3>
          <div class="detail-model-meta">
            <div><span>Context Length</span><strong>${model.context}</strong></div>
            <div><span>Input Price</span><strong>${model.inputPrice}</strong></div>
            <div><span>Output Price</span><strong>${model.outputPrice}</strong></div>
          </div>
          <div class="capability-tags">
            ${model.tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");

  container.innerHTML = `
    <aside class="provider-detail-side">
      <div class="provider-logo-mark">${provider.name.charAt(0)}</div>
      <h2>${provider.name}</h2>
      <span class="status-pill ${provider.statusClass}">${provider.status}</span>
      <p class="provider-detail-desc">${provider.description}</p>
      <dl class="provider-meta-list">
        <div><dt>Routing Level</dt><dd>${provider.routingLevel}</dd></div>
        <div><dt>Latency</dt><dd>${provider.latency}</dd></div>
        <div><dt>Region</dt><dd>${provider.region}</dd></div>
        <div><dt>Availability</dt><dd>${provider.availability}</dd></div>
      </dl>
    </aside>
    <section class="provider-detail-main">
      <div class="dash-section-header"><h2>Available Models</h2></div>
      <div class="detail-models-list">${modelCards}</div>
    </section>
    <aside class="provider-detail-actions">
      <div class="dash-section-header"><h2>Quick Actions</h2></div>
      <div class="action-stack">
        <a href="apikeys.html?provider=${provider.id}" class="button button-primary">Generate API Key</a>
        <a class="button button-secondary" href="playground.html?provider=${provider.id}&model=${fmt.slugify(provider.models[0].name)}">Test in Playground</a>
        <a class="button button-secondary" href="documentation.html">API Documentation</a>
        <a class="button button-secondary" href="credits.html">Pricing</a>
      </div>
    </aside>
  `;
});
