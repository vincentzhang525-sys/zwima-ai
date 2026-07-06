(function () {
  let walletCache = null;
  let recordsCache = [];

  function isSupabase() {
    return window.ZwimaDbMode?.isSupabaseMode?.();
  }

  async function refreshFromDb() {
    const data = await window.ZwimaSupabaseApi.apiFetch("/api/credits");
    walletCache = data.wallet;
    return walletCache;
  }

  window.ZwimaSupabaseCredits = {
    async refreshFromDb,
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
      return refreshFromDb();
    },
    async topUp(amountEur) {
      await window.ZwimaSupabaseApi.apiFetch("/api/credits", {
        method: "POST",
        body: JSON.stringify({ action: "topup", amountEur }),
      });
      return refreshFromDb();
    },
    async addAdjustment(amount, description) {
      await window.ZwimaSupabaseApi.apiFetch("/api/credits", {
        method: "POST",
        body: JSON.stringify({ action: "adjustment", amount, description }),
      });
      return refreshFromDb();
    },
    isSupabase,
  };
})();
