async function loadKnowledge(category) {
  const url = category ? `/api/knowledge?category=${encodeURIComponent(category)}` : "/api/knowledge";
  const res = await fetch(url);
  const data = await res.json();
  const nav = document.getElementById("kbNav");
  const grid = document.getElementById("kbArticles");
  const articleBox = document.getElementById("kbArticle");

  nav.innerHTML = (data.categories || [])
    .map((c) => `<button class="button button-sm button-secondary" data-cat="${c}" type="button">${c}</button>`)
    .join("");
  nav.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => loadKnowledge(btn.dataset.cat));
  });

  const articles = data.articles || [];
  grid.innerHTML = articles
    .map(
      (a) => `<article class="status-provider-card" data-slug="${a.slug}" style="cursor:pointer;">
      <h2 style="margin:0 0 8px;font-size:1rem;">${a.title}</h2>
      <p class="muted" style="margin:0;">${a.summary}</p>
      <p style="margin:8px 0 0;font-size:0.85rem;"><span class="status-pill planned">${a.category}</span></p>
    </article>`
    )
    .join("");

  grid.querySelectorAll("[data-slug]").forEach((card) => {
    card.addEventListener("click", async () => {
      const r = await fetch(`/api/knowledge?slug=${encodeURIComponent(card.dataset.slug)}`);
      const d = await r.json();
      const a = d.article;
      articleBox.style.display = "block";
      articleBox.innerHTML = `<h2>${a.title}</h2><p class="muted">${a.category}</p><div style="margin-top:12px;white-space:pre-wrap;">${a.body}</div>`;
      articleBox.scrollIntoView({ behavior: "smooth" });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => loadKnowledge());
