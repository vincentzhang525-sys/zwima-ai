(function () {
  async function api(path, method, body) {
    return window.ZwimaSupabaseApi.apiFetch(path, method, body);
  }

  function fmtDate(v) {
    return v ? new Date(v).toLocaleString("en-GB") : "—";
  }

  function statusPill(status) {
    const cls = ["resolved", "closed", "released"].includes(status) ? "active" : "planned";
    return `<span class="status-pill ${cls}">${status}</span>`;
  }

  async function loadTickets() {
    const res = await api("/api/support", "GET");
    const body = document.getElementById("ticketsBody");
    const tickets = (res.records || []).filter((r) => r.recordType === "ticket");
    if (!tickets.length) {
      body.innerHTML = '<tr><td colspan="6" class="muted">No tickets yet.</td></tr>';
      return;
    }
    body.innerHTML = tickets
      .map(
        (t) => `<tr>
        <td>${t.ticketNumber}</td><td>${t.title}</td><td>${t.category || "—"}</td>
        <td>${t.priority}</td><td>${statusPill(t.status)}</td><td>${fmtDate(t.createdAt)}</td>
      </tr>`
      )
      .join("");

    const cats = res.categories || [];
    const sel = document.getElementById("ticketCategory");
    sel.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join("");
  }

  async function loadFeatureBoard() {
    const [mine, board] = await Promise.all([
      api("/api/support", "GET"),
      fetch("/api/support/board").then((r) => r.json()),
    ]);
    const body = document.getElementById("featuresBody");
    const features = board.topRequested || [];
    if (!features.length) {
      body.innerHTML = '<tr><td colspan="4" class="muted">No feature requests yet.</td></tr>';
      return;
    }
    const voted = new Set((mine.records || []).filter((r) => r.hasVoted).map((r) => r.id));
    body.innerHTML = features
      .map((f) => {
        const hasVoted = voted.has(f.id) || f.hasVoted;
        return `<tr>
          <td>${f.title}</td><td>${f.voteCount || 0}</td><td>${statusPill(f.roadmapStatus || f.status)}</td>
          <td><button class="button button-sm button-secondary" data-vote="${f.id}" type="button">${hasVoted ? "Unvote" : "Vote"}</button></td>
        </tr>`;
      })
      .join("");
    body.querySelectorAll("[data-vote]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api("/api/support", "POST", { action: "vote_feature", featureId: btn.dataset.vote });
        await loadFeatureBoard();
      });
    });
  }

  async function readScreenshot(file) {
    if (!file) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  document.getElementById("ticketForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/support", "POST", {
      action: "create_ticket",
      category: document.getElementById("ticketCategory").value,
      priority: document.getElementById("ticketPriority").value,
      title: document.getElementById("ticketTitle").value,
      description: document.getElementById("ticketDescription").value,
    });
    e.target.reset();
    await loadTickets();
    alert("Ticket submitted.");
  });

  document.getElementById("bugForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("bugScreenshot").files?.[0];
    const screenshotUrl = await readScreenshot(file);
    await api("/api/support", "POST", {
      action: "create_bug",
      title: document.getElementById("bugTitle").value,
      description: document.getElementById("bugDescription").value,
      stepsToReproduce: document.getElementById("bugSteps").value,
      browser: document.getElementById("bugBrowser").value,
      operatingSystem: document.getElementById("bugOs").value,
      severity: document.getElementById("bugSeverity").value,
      screenshotUrl,
    });
    e.target.reset();
    alert("Bug report submitted.");
  });

  document.getElementById("featureForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/support", "POST", {
      action: "create_feature",
      title: document.getElementById("featureTitle").value,
      description: document.getElementById("featureDescription").value,
    });
    e.target.reset();
    await loadFeatureBoard();
    alert("Feature request submitted.");
  });

  document.addEventListener("DOMContentLoaded", async () => {
    if (window.ZwimaAuthGuard) await window.ZwimaAuthGuard.requireAuth();
    await Promise.all([loadTickets(), loadFeatureBoard()]);
  });
})();
