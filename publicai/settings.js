function showMessage(el, message) {
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

function populateSettingsForm() {
  const user = window.ZwimaAuthService?.getCurrentUser?.();
  if (!user) return;

  const fields = {
    settingsEmail: user.email,
    settingsCompany: user.company,
    settingsCountry: user.country,
    settingsRole: user.role,
    settingsStatus: user.status,
    settingsPlan: user.plan,
  };

  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value || "";
  });
}

document.getElementById("settingsForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById("settingsError");
  const successEl = document.getElementById("settingsSuccess");
  showMessage(errorEl, "");
  showMessage(successEl, "");

  try {
    await window.ZwimaAuthService.updateProfile({
      company: document.getElementById("settingsCompany")?.value,
      country: document.getElementById("settingsCountry")?.value,
    });
    populateSettingsForm();
    window.ZwimaLayoutHeader?.renderUser?.();
    showMessage(successEl, "Profile updated successfully.");
  } catch (err) {
    showMessage(errorEl, err.message || "Could not save profile.");
  }
});

document.getElementById("settingsLogoutBtn")?.addEventListener("click", () => {
  window.ZwimaAuthService?.logout?.().finally(() => {
    window.location.href = "login.html";
  });
});

document.addEventListener("DOMContentLoaded", populateSettingsForm);
