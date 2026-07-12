(function () {
  let walletCache = null;

  function isSupabase() {
    return window.ZwimaDbMode?.isSupabaseMode?.();
  }

  async function refreshFromDb() {
    const data = await window.ZwimaSupabaseApi.apiFetch("/api/credits");
    walletCache = data.wallet;
    const user = window.ZwimaAuthService?.getCurrentUser?.();
    if (user && window.ZwimaStorage && walletCache) {
      window.ZwimaStorage.set("SESSION", {
        ...user,
        credits: walletCache.balance,
        creditsBalance: String(walletCache.balance),
      });
    }
    return walletCache;
  }

  window.ZwimaSupabaseCredits = {
    refreshFromDb,
    getCachedWallet() {
      return walletCache;
    },
    setCachedWallet(wallet) {
      walletCache = wallet;
      const user = window.ZwimaAuthService?.getCurrentUser?.();
      if (user && window.ZwimaStorage) {
        window.ZwimaStorage.set("SESSION", {
          ...user,
          credits: wallet.balance,
          creditsBalance: String(wallet.balance),
        });
      }
    },
    async spend(amount, description) {
      await window.ZwimaSupabaseApi.apiFetch("/api/credits", {
        method: "POST",
        body: JSON.stringify({ action: "spend", amount, description }),
      });
      const wallet = await refreshFromDb();
      window.ZwimaAppEvents?.emit?.("data-updated", { source: "credits" });
      return wallet;
    },
    async topUp(amountEur) {
      throw new Error("Credit purchases must go through Billing. Redirecting…");
    },
    async addAdjustment(amount, description) {
      throw new Error("Balance adjustments are admin-only.");
    },
    isSupabase,
  };
})();
