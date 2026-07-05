(function () {
  async function getDb() {
    await window.ZwimaDatabase.init();
    return window.ZwimaDatabase.getRepositories();
  }

  const FALLBACK_USER = {
    name: "Alex Weber",
    company: "Zwima Technologie GmbH",
    email: "alex.weber@company.eu",
    plan: "Early Access",
    contactName: "Alex Weber",
    country: "Germany",
    language: "English",
    timezone: "Europe/Berlin",
    vatNumber: "DE321456789",
    apiKeyCount: 4,
    creditsBalance: "12,450",
  };

  window.ZwimaUserService = {
    getSessionSync() {
      const jwtUser = window.ZwimaJwtManager?.getUserFromAccessToken();
      const stored = window.ZwimaStorage.get("SESSION", null);
      const base = { ...FALLBACK_USER, ...(stored || {}) };
      if (jwtUser?.sub) {
        return { ...base, ...jwtUser, id: jwtUser.sub };
      }
      return base;
    },
    getSession() {
      const stored = window.ZwimaStorage.get("SESSION", null);
      if (stored) return Promise.resolve(stored);
      return getDb().then((db) => db.users.getSession());
    },
    saveSession(data) {
      const next = { ...this.getSessionSync(), ...data };
      window.ZwimaStorage.set("SESSION", next);
      return getDb().then((db) => db.users.saveSession(next));
    },
    clearSession() {
      window.ZwimaStorage.remove("SESSION");
      return getDb().then((db) => db.users.clearSession());
    },
    getProfile() {
      return this.getSession();
    },
    updateProfile(data) {
      return this.saveSession(data);
    },
    getApiAccessSummary() {
      return this.getSession().then((user) => ({
        plan: user.plan,
        apiKeyCount: user.apiKeyCount,
        creditsBalance: user.creditsBalance,
      }));
    },
  };
})();
