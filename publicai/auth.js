const AUTH_TABS = [
  { mode: "signin", label: "Sign In" },
  { mode: "register", label: "Create Account" },
  { mode: "forgot", label: "Forgot Password" },
  { mode: "verify", label: "Verify Email" },
  { mode: "reset", label: "Reset Password" },
  { mode: "profile", label: "Profile" },
];

function getMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") || "signin";
}

function setMode(mode) {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url);
  showMode(mode);
}

function showMode(mode) {
  document.querySelectorAll(".auth-view").forEach((view) => {
    view.classList.toggle("active", view.dataset.mode === mode);
  });

  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });

  if (mode === "profile") {
    loadProfileForm();
    loadSessions();
  }

  document.title = `${AUTH_TABS.find((t) => t.mode === mode)?.label || "Account"} | ZWIMA AI`;
}

function renderAuthTabs() {
  const tabs = document.getElementById("authTabs");
  if (!tabs) return;

  tabs.innerHTML = AUTH_TABS.map(
    (tab) => `<a class="auth-tab" href="auth.html?mode=${tab.mode}" data-mode="${tab.mode}">${tab.label}</a>`
  ).join("");
}

function loadProfileForm() {
  const user = ZwimaSession.getSession();
  const map = {
    profileCompany: user.company,
    profileContact: user.contactName || user.name,
    profileEmail: user.email,
    profileBillingEmail: user.billingEmail || user.email,
    profileCountry: user.country,
    profileLanguage: user.language,
    profileTimezone: user.timezone,
    profileVat: user.vatNumber,
    accessPlan: user.plan,
    accessKeys: user.apiKeyCount,
    accessCredits: user.creditsBalance,
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "STRONG") el.textContent = value;
    else el.value = value;
  });
}

async function loadSessions() {
  const list = document.querySelector(".session-list");
  if (!list || !window.ZwimaAuthService?.isAuthenticated()) return;
  try {
    const sessions = await window.ZwimaAuthService.getSessions();
    list.innerHTML = sessions
      .map(
        (s) => `
        <li class="session-item">
          <span>${s.device} · ${s.location}</span>
          ${s.current ? '<span class="status-pill active">Active</span>' : `<button class="button button-secondary button-sm" type="button" data-session-id="${s.id}">Revoke</button>`}
        </li>`
      )
      .join("");
  } catch {
    /* keep static fallback */
  }
}

renderAuthTabs();
showMode(getMode());

document.getElementById("signInForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("signInEmail")?.value;
  const password = document.getElementById("signInPassword")?.value;
  const remember = document.getElementById("signInRemember")?.checked;
  await window.ZwimaAuthService.signIn({ email, password, remember });
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") || "dashboard.html";
  window.location.href = redirect;
});

document.getElementById("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await window.ZwimaAuthService.signUp({
    company: document.getElementById("registerCompany")?.value,
    name: document.getElementById("registerName")?.value,
    email: document.getElementById("registerEmail")?.value,
    password: document.getElementById("registerPassword")?.value,
  });
  setMode("verify");
});

document.getElementById("forgotForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await window.ZwimaAuthService.forgotPassword({ email: document.getElementById("forgotEmail")?.value });
  setMode("reset");
});

document.getElementById("verifyForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  window.alert("Email verified successfully.");
  setMode("signin");
});

document.getElementById("resetForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pass = document.getElementById("resetPassword")?.value;
  const confirm = document.getElementById("resetConfirm")?.value;
  if (pass !== confirm) {
    window.alert("Passwords do not match.");
    return;
  }
  await window.ZwimaAuthService.resetPassword({
    email: document.getElementById("forgotEmail")?.value || "admin@zwima-group.info",
    password: pass,
  });
  window.alert("Password reset successfully.");
  setMode("signin");
});

document.getElementById("profileForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await window.ZwimaAuthService.updateProfile({
    company: document.getElementById("profileCompany")?.value,
    contactName: document.getElementById("profileContact")?.value,
    name: document.getElementById("profileContact")?.value,
    email: document.getElementById("profileEmail")?.value,
    billingEmail: document.getElementById("profileBillingEmail")?.value,
    country: document.getElementById("profileCountry")?.value,
    language: document.getElementById("profileLanguage")?.value,
    timezone: document.getElementById("profileTimezone")?.value,
    vatNumber: document.getElementById("profileVat")?.value,
  });
  window.alert("Profile saved.");
});

document.getElementById("changePasswordBtn")?.addEventListener("click", () => {
  setMode("reset");
});

document.getElementById("signOutLink")?.addEventListener("click", async (event) => {
  event.preventDefault();
  await window.ZwimaAuthService.signOut();
  window.location.href = "auth.html?mode=signin";
});

document.getElementById("profileNav")?.addEventListener("click", (event) => {
  const link = event.target.closest("[data-section]");
  if (!link) return;
  event.preventDefault();

  document.querySelectorAll(".profile-nav a[data-section]").forEach((item) => {
    item.classList.toggle("active", item === link);
  });

  document.querySelectorAll(".profile-section").forEach((section) => {
    section.classList.toggle("active", section.id === link.dataset.section);
  });
});

document.querySelector(".session-list")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-session-id]");
  if (!button) return;
  await window.ZwimaAuthService.revokeSession(button.dataset.sessionId);
  loadSessions();
});

document.getElementById("twoFactorToggle")?.addEventListener("change", (event) => {
  const enabled = event.target.checked;
  window.alert(enabled ? "Two factor authentication enabled (simulated)." : "Two factor authentication disabled.");
});
