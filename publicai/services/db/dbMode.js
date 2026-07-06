(function () {
  function isSupabaseMode() {
    const dbMode = String(window.ZWIMA_CONFIG?.DB_MODE || "").toLowerCase();
    return (
      window.ZWIMA_CONFIG?.AUTH_PROVIDER === "supabase" ||
      window.ZWIMA_CONFIG?.DB_DRIVER === "supabase" ||
      dbMode === "supabase"
    );
  }

  window.ZwimaDbMode = {
    isSupabaseMode,
  };
})();
