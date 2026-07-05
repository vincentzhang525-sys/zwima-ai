document.addEventListener("DOMContentLoaded", async () => {
  const providerList = document.getElementById("providerList");
  if (!providerList) return;

  const providers = await window.ZwimaProviderService.getMarketplaceProviders();
  const fmt = window.ZwimaFormat;

  providerList.innerHTML = providers
    .map((provider) => {
      const models = provider.models.map((m) => `<li>${m.name}</li>`).join("");
      const tagHtml = provider.tags.map((tag) => `<span>${tag}</span>`).join("");

      return `
        <article class="provider-card">
          <a href="provider.html?provider=${provider.id}" class="provider-card-link-inner">
            <div class="provider-card-header">
              <div>
                <h2>${provider.name}</h2>
                <p>${provider.description}</p>
              </div>
              <span class="status-pill ${provider.statusClass}">${provider.status}</span>
            </div>
            <div class="provider-card-body">
              <div class="provider-field">
                <span class="provider-label">Models</span>
                <ul class="model-list">${models}</ul>
              </div>
              <div class="provider-field">
                <span class="provider-label">Capabilities</span>
                <div class="capability-tags">${tagHtml}</div>
              </div>
              <div class="provider-field">
                <span class="provider-label">Routing Role</span>
                <p class="provider-value">${provider.routingRole}</p>
              </div>
            </div>
            <p class="provider-card-cta">View provider details →</p>
          </a>
          <div class="provider-card-actions">
            <a class="button button-primary" href="playground.html?provider=${provider.id}&model=${provider.firstModelSlug}">Test in Playground</a>
            <a class="button button-secondary" href="documentation.html">View Docs</a>
          </div>
        </article>
      `;
    })
    .join("");
});
