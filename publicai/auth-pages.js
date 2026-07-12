(function () {
  function setSubmitting(formId, active, text) {
    const form = document.getElementById(formId);
    if (!form) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (active) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = text || "Please wait...";
      button.disabled = true;
      return;
    }
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
  }

  function showSuccess(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

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
    setSubmitting("loginForm", true, "Signing in...");
    try {
      await window.ZwimaAuthService.login({
        email: document.getElementById("loginEmail")?.value,
        password: document.getElementById("loginPassword")?.value,
        remember: Boolean(document.getElementById("rememberMe")?.checked),
      });
      redirectAfterAuth();
    } catch (err) {
      showError(errorEl, err.message || "Sign in failed. Please check your email and password.");
    } finally {
      setSubmitting("loginForm", false);
    }
  });

  document.getElementById("signupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("signupError");
    const successEl = document.getElementById("signupSuccess");
    showError(errorEl, "");
    showSuccess(successEl, "");
    setSubmitting("signupForm", true, "Creating account...");
    try {
      const result = await window.ZwimaAuthService.register({
        company: document.getElementById("signupCompany")?.value,
        email: document.getElementById("signupEmail")?.value,
        password: document.getElementById("signupPassword")?.value,
        country: document.getElementById("signupCountry")?.value,
        role: "customer",
      });
      if (result?.user) {
        showSuccess(successEl, "Account created successfully. Redirecting to dashboard...");
        setTimeout(() => redirectAfterAuth(), 700);
      } else {
        const email = document.getElementById("signupEmail")?.value;
        sessionStorage.setItem("zwima_pending_email", email || "");
        window.location.href = `verify-email.html?email=${encodeURIComponent(email || "")}`;
      }
    } catch (err) {
      showError(errorEl, err.message || "Sign up failed. Please verify your input and try again.");
    } finally {
      setSubmitting("signupForm", false);
    }
  });

  document.getElementById("forgotForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("forgotError");
    const successEl = document.getElementById("forgotSuccess");
    showError(errorEl, "");
    showSuccess(successEl, "");
    setSubmitting("forgotForm", true, "Sending...");
    try {
      const result = await window.ZwimaAuthService.forgotPassword({
        email: document.getElementById("forgotEmail")?.value,
      });
      showSuccess(successEl, result.message || "Password reset instructions sent.");
    } catch (err) {
      showError(errorEl, err.message || "Request failed. Please try again.");
    } finally {
      setSubmitting("forgotForm", false);
    }
  });

  document.getElementById("verifyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("verifyError");
    const successEl = document.getElementById("verifySuccess");
    showError(errorEl, "");
    showSuccess(successEl, "");
    setSubmitting("verifyForm", true, "Verifying...");
    try {
      const email =
        document.getElementById("verifyEmail")?.value ||
        new URLSearchParams(window.location.search).get("email") ||
        sessionStorage.getItem("zwima_pending_email") ||
        "";
      await window.ZwimaAuthService.verifyEmail(document.getElementById("verifyCode")?.value, email);
      showSuccess(successEl, "Email verified successfully. Redirecting to dashboard...");
      setTimeout(() => {
        redirectAfterAuth();
      }, 900);
    } catch (err) {
      showError(errorEl, err.message || "Verification failed.");
    } finally {
      setSubmitting("verifyForm", false);
    }
  });

  const pending = window.ZwimaAuthService?.getPendingRegistration?.();
  const pendingEmail = document.getElementById("pendingEmail");
  if (pendingEmail && pending?.email) {
    pendingEmail.textContent = pending.email;
  }

  document.getElementById("resetForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("resetError");
    const successEl = document.getElementById("resetSuccess");
    showError(errorEl, "");
    showSuccess(successEl, "");
    setSubmitting("resetForm", true, "Updating...");
    try {
      const result = await window.ZwimaAuthService.resetPassword({
        email: document.getElementById("resetEmail")?.value,
        code: document.getElementById("resetCode")?.value,
        password: document.getElementById("resetPassword")?.value,
      });
      showSuccess(successEl, result.message || "Password updated. You can sign in now.");
    } catch (err) {
      showError(errorEl, err.message || "Reset failed.");
    } finally {
      setSubmitting("resetForm", false);
    }
  });
})();
