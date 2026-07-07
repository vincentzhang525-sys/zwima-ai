(function () {
  const STEP_LABELS = {
    registered: "Register",
    email_verified: "Verify Email",
    api_key_created: "Create API Key",
    credits_received: "Free Credits",
    playground_opened: "Open Playground",
    first_api_call: "First API Call",
    plan_upgraded: "Upgrade Plan",
  };

  async function fetchProgress() {
    return window.ZwimaSupabaseApi.apiFetch("/api/onboarding");
  }

  async function completeStep(step) {
    return window.ZwimaSupabaseApi.apiFetch("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ step }),
    });
  }

  function renderBar(container, onboarding) {
    if (!container || !onboarding) return;
    if (onboarding.completed) {
      container.style.display = "none";
      return;
    }
    const steps = onboarding.steps || [];
    container.style.display = "";
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <strong>Getting started</strong>
          <p class="muted" style="margin:4px 0 0;">${onboarding.completedCount}/${onboarding.totalSteps} steps complete (${onboarding.percent}%)</p>
        </div>
        <a class="button button-primary" href="playground.html">Continue</a>
      </div>
      <div class="onboarding-steps">
        ${steps
          .map(
            (s) =>
              `<span class="onboarding-step ${s.completed ? "done" : ""}" title="${STEP_LABELS[s.id] || s.label}">${STEP_LABELS[s.id] || s.label}</span>`
          )
          .join("")}
      </div>`;
  }

  async function loadAndRender(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return null;
    try {
      const data = await fetchProgress();
      renderBar(el, data.onboarding);
      return data.onboarding;
    } catch {
      el.style.display = "none";
      return null;
    }
  }

  window.ZwimaOnboardingService = {
    STEP_LABELS,
    fetchProgress,
    completeStep,
    renderBar,
    loadAndRender,
  };
})();
