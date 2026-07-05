(function () {
  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  function redirectAfterAuth() {
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("redirect") || "dashboard.html";
  }

  document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("loginError");
    showError(errorEl, "");
    try {
      await window.ZwimaAuthService.login({
        email: document.getElementById("loginEmail")?.value,
        password: document.getElementById("loginPassword")?.value,
      });
      redirectAfterAuth();
    } catch (err) {
      showError(errorEl, err.message || "Sign in failed.");
    }
  });

  document.getElementById("signupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("signupError");
    showError(errorEl, "");
    try {
      await window.ZwimaAuthService.register({
        company: document.getElementById("signupCompany")?.value,
        email: document.getElementById("signupEmail")?.value,
        password: document.getElementById("signupPassword")?.value,
        country: document.getElementById("signupCountry")?.value,
        role: document.getElementById("signupRole")?.value,
      });
      window.location.href = "verify-email.html";
    } catch (err) {
      showError(errorEl, err.message || "Sign up failed.");
    }
  });

  document.getElementById("forgotForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("forgotError");
    const successEl = document.getElementById("forgotSuccess");
    showError(errorEl, "");
    if (successEl) successEl.hidden = true;
    try {
      const result = await window.ZwimaAuthService.forgotPassword({
        email: document.getElementById("forgotEmail")?.value,
      });
      if (successEl) {
        successEl.textContent = result.message;
        successEl.hidden = false;
      }
    } catch (err) {
      showError(errorEl, err.message || "Request failed.");
    }
  });

  document.getElementById("verifyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("verifyError");
    const successEl = document.getElementById("verifySuccess");
    showError(errorEl, "");
    if (successEl) successEl.hidden = true;
    try {
      await window.ZwimaAuthService.verifyEmail(document.getElementById("verifyCode")?.value);
      if (successEl) {
        successEl.textContent = "Email verified successfully. Redirecting to dashboard…";
        successEl.hidden = false;
      }
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 900);
    } catch (err) {
      showError(errorEl, err.message || "Verification failed.");
    }
  });

  const pending = window.ZwimaAuthService?.getPendingRegistration?.();
  const pendingEmail = document.getElementById("pendingEmail");
  if (pendingEmail && pending?.email) {
    pendingEmail.textContent = pending.email;
  }
})();
