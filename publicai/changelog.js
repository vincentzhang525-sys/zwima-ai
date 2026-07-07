async function loadChangelog() {
  const res = await fetch("/api/changelog");
  const data = await res.json();
  const h = data.highlights || {};
  document.getElementById("changelogHighlights").innerHTML = `
    <article class="overview-card"><span>Sprint Releases</span><strong>${(h.sprintReleases || []).length}</strong></article>
    <article class="overview-card"><span>Bug Fixes</span><strong>${(h.bugFixes || []).length}</strong></article>
    <article class="overview-card"><span>Security</span><strong>${(h.securityPatches || []).length}</strong></article>
    <article class="overview-card"><span>Providers</span><strong>${(h.newProviders || []).length}</strong></article>`;

  document.getElementById("changelogEntries").innerHTML = (data.entries || [])
    .map((entry) => {
      const sections = Object.entries(entry.sections || {})
        .map(([name, items]) => {
          if (!items.length) return "";
          return `<h3 style="margin:16px 0 8px;font-size:0.95rem;">${name}</h3><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
        })
        .join("");
      return `<article class="notice-box" style="margin-bottom:16px;">
        <h2 style="margin:0 0 4px;font-size:1.1rem;">${entry.title}</h2>
        ${entry.date ? `<p class="muted" style="margin:0 0 8px;">${entry.date}</p>` : ""}
        ${sections}
      </article>`;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", loadChangelog);
