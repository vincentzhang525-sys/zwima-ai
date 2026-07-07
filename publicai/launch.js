(function () {
  function injectBetaBar() {
    if (document.querySelector(".zwima-beta-bar")) return;
    const bar = document.createElement("div");
    bar.className = "zwima-beta-bar";
    bar.setAttribute("role", "status");
    bar.innerHTML = `
      <span class="zwima-beta-pill">BETA</span>
      <span>ZWIMA AI is in public beta. OpenAI and Gemini are live. <a href="status.html">Provider status</a></span>
      <span class="zwima-beta-actions">
        <a href="contact.html#waitlist">Join waitlist</a>
        <a href="mailto:hello@zwima-group.info?subject=ZWIMA%20Beta%20Feedback">Feedback</a>
        <a href="mailto:hello@zwima-group.info?subject=ZWIMA%20Bug%20Report">Report bug</a>
      </span>`;
    document.body.prepend(bar);
  }

  function injectFeedbackFab() {
    if (document.querySelector(".zwima-feedback-fab")) return;
    const fab = document.createElement("a");
    fab.className = "zwima-feedback-fab";
    fab.href = "mailto:hello@zwima-group.info?subject=ZWIMA%20Beta%20Feedback";
    fab.textContent = "Feedback";
    fab.setAttribute("aria-label", "Send beta feedback");
    document.body.appendChild(fab);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("dashboard-body")) return;
    injectBetaBar();
    injectFeedbackFab();
  });
})();
