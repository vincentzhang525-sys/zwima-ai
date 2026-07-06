(function () {
  function isSupabaseMode() {
    return (
      window.ZWIMA_CONFIG?.AUTH_PROVIDER === "supabase" ||
      window.ZWIMA_CONFIG?.DB_DRIVER === "supabase"
    );
  }

  window.ZwimaDbMode = {
    isSupabaseMode,
  };
})();
