(function () {
  async function getDb() {
    if (!window.ZwimaDatabase) return null;
    await window.ZwimaDatabase.init();
    return window.ZwimaDatabase.getRepositories();
  }

  window.ZwimaUserService = {
    getSessionSync() {
      const authUser = window.ZwimaAuthService?.getCurrentUser?.();
      if (authUser?.email) return authUser;

      const jwtUser = window.ZwimaJwtManager?.getUserFromAccessToken?.();
      const stored = window.ZwimaStorage?.get?.("SESSION", null);
      const base = stored || {};
      if (jwtUser?.sub) {
        return { ...base, ...jwtUser, id: jwtUser.sub };
      }
      return base;
    },
    getSession() {
      const stored = window.ZwimaStorage?.get?.("SESSION", null);
      if (stored) return Promise.resolve(stored);
      return getDb().then((db) => db?.users?.getSession?.() || null);
    },
    saveSession(data) {
      const next = { ...this.getSessionSync(), ...data };
      window.ZwimaStorage?.set?.("SESSION", next);
      return getDb().then((db) => db?.users?.saveSession?.(next) || next);
    },
    clearSession() {
      window.ZwimaStorage?.remove?.("SESSION");
      return getDb().then((db) => db?.users?.clearSession?.() || null);
    },
    getProfile() {
      return this.getSession();
    },
    updateProfile(data) {
      return this.saveSession(data);
    },
    getApiAccessSummary() {
      return this.getSession().then((user) => ({
        plan: user?.plan,
        apiKeyCount: user?.apiKeyCount,
        creditsBalance: user?.creditsBalance,
      }));
    },
  };
})();
