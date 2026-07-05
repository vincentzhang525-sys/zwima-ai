(function (root) {
  function applyAuthResult(result) {
    const data = result.user ? result : result.data || result;
    const user = data.user || data;
    const tokens = data.tokens;
    if (tokens && root.ZwimaJwtManager) {
      root.ZwimaJwtManager.setTokens(tokens);
      root.ZwimaSessionManager?.rememberLogin?.(!!data.remember);
      if (data.session) root.ZwimaSessionManager?.registerSession?.(data.session);
      root.ZwimaJwtManager.scheduleAutoRefresh?.(() => root.ZwimaAuthService.refreshToken());
    }
    if (root.ZwimaStorage) root.ZwimaStorage.set("SESSION", user);
    return user;
  }

  root.ZwimaApiAuthAdapter = {
    name: "api",

    isAuthenticated() {
      const token = root.ZwimaJwtManager?.getAccessToken?.();
      if (!token) return false;
      return !root.ZwimaJwtManager.isExpired(token);
    },

    getCurrentUser() {
      const jwtUser = root.ZwimaJwtManager?.getUserFromAccessToken?.();
      const stored = root.ZwimaStorage?.get("SESSION", null);
      if (stored) return stored;
      return jwtUser || null;
    },

    register(payload) {
      return root.ZwimaDatabase.queryApi("/api/auth/signup", "POST", payload).then((r) => applyAuthResult(r.data));
    },

    login(credentials) {
      return root.ZwimaDatabase.queryApi("/api/auth/signin", "POST", credentials).then((r) =>
        applyAuthResult({ ...r.data, remember: credentials?.remember })
      );
    },

    logout() {
      const refreshToken = root.ZwimaJwtManager?.getRefreshToken?.();
      return root.ZwimaDatabase.queryApi("/api/auth/signout", "POST", { refreshToken }).then(() => {
        root.ZwimaJwtManager?.clearTokens?.();
        root.ZwimaSessionManager?.clearAll?.();
        root.ZwimaStorage?.remove?.("SESSION");
        return { success: true };
      });
    },

    forgotPassword(payload) {
      return root.ZwimaDatabase.queryApi("/api/auth/forgot", "POST", payload).then((r) => r.data);
    },

    verifyEmail() {
      return Promise.resolve({ verified: true });
    },

    getPendingRegistration() {
      return null;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
