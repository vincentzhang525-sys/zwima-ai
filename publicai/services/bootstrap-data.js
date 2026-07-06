(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.ZwimaAuthService?.isAuthenticated?.()) return;
    if (!window.ZwimaDbMode?.isSupabaseMode?.()) return;

    try {
      await Promise.all([
        window.ZwimaSupabaseCredits?.refreshFromDb?.(),
        window.ZwimaSupabaseUsage?.refreshFromDb?.(),
        window.ZwimaSupabaseApiKeys?.refreshFromDb?.(),
        window.ZwimaConversationService?.refreshFromDb?.(),
      ]);
    } catch (err) {
      console.warn("[bootstrap-data] Failed to preload Supabase data:", err);
    }
  });
})();
