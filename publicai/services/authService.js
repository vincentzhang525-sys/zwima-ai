(function () {
  function applyAuthResult(result) {
    const data = result.user ? result : result.data || result;
    const user = data.user || data;
    const tokens = data.tokens;
    if (tokens) {
      window.ZwimaJwtManager.setTokens(tokens);
      window.ZwimaSessionManager.rememberLogin(!!data.remember);
      if (data.session) window.ZwimaSessionManager.registerSession(data.session);
      window.ZwimaJwtManager.scheduleAutoRefresh(() => window.ZwimaAuthService.refreshToken());
    }
    window.ZwimaStorage.set("SESSION", user);
    return user;
  }

  window.ZwimaAuthService = {
    signIn(credentials) {
      return window.ZwimaDatabase.queryApi("/api/auth/signin", "POST", credentials).then((r) =>
        applyAuthResult({ ...r.data, remember: credentials?.remember })
      );
    },
    signUp(payload) {
      return window.ZwimaDatabase.queryApi("/api/auth/signup", "POST", payload).then((r) => applyAuthResult(r.data));
    },
    register(payload) {
      return this.signUp(payload);
    },
    signOut() {
      const refreshToken = window.ZwimaJwtManager.getRefreshToken();
      return window.ZwimaDatabase.queryApi("/api/auth/signout", "POST", { refreshToken }).then(() => {
        window.ZwimaJwtManager.clearTokens();
        window.ZwimaSessionManager.clearAll();
        window.ZwimaStorage.remove("SESSION");
      });
    },
    forgotPassword(payload) {
      return window.ZwimaDatabase.queryApi("/api/auth/forgot", "POST", payload).then((r) => r.data);
    },
    resetPassword(payload) {
      return window.ZwimaDatabase.queryApi("/api/auth/reset", "POST", payload).then((r) => r.data);
    },
    refreshToken() {
      const refreshToken = window.ZwimaJwtManager.getRefreshToken();
      return window.ZwimaDatabase.queryApi("/api/auth/refresh", "POST", { refreshToken }).then((r) => applyAuthResult(r.data));
    },
    getCurrentUser() {
      const token = window.ZwimaJwtManager.getAccessToken();
      return window.ZwimaDatabase.queryApi("/api/auth/me", "GET", null, {
        authorization: `Bearer ${token}`,
      }).then((r) => r.data);
    },
    getSessions() {
      const token = window.ZwimaJwtManager.getAccessToken();
      return window.ZwimaDatabase.queryApi("/api/auth/sessions", "GET", null, {
        authorization: `Bearer ${token}`,
      }).then((r) => r.data);
    },
    revokeSession(sessionId) {
      const token = window.ZwimaJwtManager.getAccessToken();
      return window.ZwimaDatabase.queryApi("/api/auth/sessions/revoke", "POST", { sessionId }, {
        authorization: `Bearer ${token}`,
      });
    },
    revokeOtherSessions() {
      const token = window.ZwimaJwtManager.getAccessToken();
      return window.ZwimaDatabase.queryApi(
        "/api/auth/sessions/revoke-others",
        "POST",
        { currentSessionId: window.ZwimaSessionManager.getCurrentSessionId() },
        { authorization: `Bearer ${token}` }
      );
    },
    updateProfile(data) {
      const token = window.ZwimaJwtManager.getAccessToken();
      return window.ZwimaDatabase.queryApi("/api/auth/profile", "POST", data, {
        authorization: `Bearer ${token}`,
      }).then((r) => {
        window.ZwimaStorage.set("SESSION", r.data);
        return r.data;
      });
    },
    hasRole(role) {
      const user = window.ZwimaJwtManager.getUserFromAccessToken() || window.ZwimaUserService.getSessionSync();
      return window.ZwimaPermissionManager.hasRole(user, role);
    },
    hasPermission(permission) {
      const user = window.ZwimaJwtManager.getUserFromAccessToken() || window.ZwimaUserService.getSessionSync();
      return window.ZwimaPermissionManager.canAccess(user, permission);
    },
    checkRole(role) {
      const token = window.ZwimaJwtManager.getAccessToken();
      return window.ZwimaDatabase.queryApi(`/api/auth/role?role=${encodeURIComponent(role)}`, "GET", null, {
        authorization: `Bearer ${token}`,
      }).then((r) => r.data);
    },
    checkPermission(permission) {
      const token = window.ZwimaJwtManager.getAccessToken();
      return window.ZwimaDatabase.queryApi(`/api/auth/permissions?permission=${encodeURIComponent(permission)}`, "GET", null, {
        authorization: `Bearer ${token}`,
      }).then((r) => r.data);
    },
    isAuthenticated() {
      return window.ZwimaAuthGuard?.isAuthenticated() || false;
    },
  };
})();
