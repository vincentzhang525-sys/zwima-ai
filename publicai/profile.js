document.addEventListener("DOMContentLoaded", async () => {
  const data = await window.ZwimaSupabaseApi.apiFetch("/api/profile");
  const p = data.profile || {};
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  };
  const avatar = document.getElementById("profileAvatar");
  if (avatar) avatar.src = p.avatar || "";
  set("profileCompany", p.company);
  set("profileEmail", p.email);
  set("profileCountry", p.country);
  set("profileLanguage", p.language);
  set("profileTimezone", p.timezone);
  set(
    "profileUsageSummary",
    `${Number(p.usageSummary?.totalRequests || 0).toLocaleString()} requests · ${Number(
      p.usageSummary?.totalTokens || 0
    ).toLocaleString()} tokens`
  );
  set("profileCreated", p.accountCreated ? new Date(p.accountCreated).toLocaleString("en-GB") : "—");
  set("profileLastLogin", p.lastLogin ? new Date(p.lastLogin).toLocaleString("en-GB") : "—");

  document.getElementById("changePasswordBtn")?.addEventListener("click", () => {
    window.location.href = "forgot-password.html";
  });
});
