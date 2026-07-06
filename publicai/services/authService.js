(function () {
  const PROTECTED_PAGES = [
    "dashboard.html",
    "apikeys.html",
    "credits.html",
    "playground.html",
    "usage.html",
    "settings.html",
    "routing.html",
    "gateway.html",
    "admin.html",
  ];

  function currentPage() {
    return (window.location.pathname.split("/").pop() || "index.html").split("?")[0];
  }

  function getProviderName() {
    return window.ZWIMA_CONFIG?.AUTH_PROVIDER || "localStorage";
  }

  function getAdapter() {
    const name = getProviderName();
    if (name === "supabase" && window.ZwimaSupabaseAuthAdapter) return window.ZwimaSupabaseAuthAdapter;
    if (name === "api" && window.ZwimaApiAuthAdapter) return window.ZwimaApiAuthAdapter;
    if (name === "supabase" && window.ZwimaSupabaseAuthAdapter) return window.ZwimaSupabaseAuthAdapter;
    if (name === "firebase" && window.ZwimaFirebaseAuthAdapter) return window.ZwimaFirebaseAuthAdapter;
    return window.ZwimaLocalStorageAuthAdapter;
  }

  function adapterCall(method, ...args) {
    const adapter = getAdapter();
    if (!adapter || typeof adapter[method] !== "function") {
      return Promise.reject(new Error(`Auth adapter does not support ${method}`));
    }
    return Promise.resolve(adapter[method](...args));
  }

  window.ZwimaAuthService = {
    getProviderName,
    getAdapter,
    PROTECTED_PAGES,

    isAuthenticated() {
      const adapter = getAdapter();
      return adapter?.isAuthenticated?.() || false;
    },

    getCurrentUser() {
      const adapter = getAdapter();
      return adapter?.getCurrentUser?.() || null;
    },

    register(payload) {
      return adapterCall("register", payload);
    },

    login(credentials) {
      return adapterCall("login", credentials);
    },

    logout() {
      return adapterCall("logout");
    },

    forgotPassword(payload) {
      return adapterCall("forgotPassword", payload);
    },

    verifyEmail(code) {
      return adapterCall("verifyEmail", code);
    },

    getPendingRegistration() {
      return getAdapter()?.getPendingRegistration?.() || null;
    },

    requireAuth() {
      if (this.isAuthenticated()) return true;
      const page = currentPage();
      const redirect = encodeURIComponent(page + window.location.search);
      window.location.href = `login.html?redirect=${redirect}`;
      return false;
    },

    signIn(credentials) {
      return this.login(credentials);
    },

    signUp(payload) {
      return this.register(payload);
    },

    signOut() {
      return this.logout();
    },

    refreshToken() {
      if (getProviderName() !== "api" || !window.ZwimaDatabase) {
        return Promise.resolve(this.getCurrentUser());
      }
      const refreshToken = window.ZwimaJwtManager?.getRefreshToken?.();
      return window.ZwimaDatabase.queryApi("/api/auth/refresh", "POST", { refreshToken }).then((r) => {
        const data = r.data;
        if (data?.tokens) window.ZwimaJwtManager.setTokens(data.tokens);
        if (data?.user) window.ZwimaStorage.set("SESSION", data.user);
        return data.user;
      });
    },

    getSessions() {
      const token = window.ZwimaJwtManager?.getAccessToken?.();
      if (!token || !window.ZwimaDatabase) return Promise.resolve([]);
      return window.ZwimaDatabase.queryApi("/api/auth/sessions", "GET", null, {
        authorization: `Bearer ${token}`,
      }).then((r) => r.data);
    },

    revokeSession(sessionId) {
      const token = window.ZwimaJwtManager?.getAccessToken?.();
      return window.ZwimaDatabase.queryApi("/api/auth/sessions/revoke", "POST", { sessionId }, {
        authorization: `Bearer ${token}`,
      });
    },

    revokeOtherSessions() {
      const token = window.ZwimaJwtManager?.getAccessToken?.();
      return window.ZwimaDatabase.queryApi(
        "/api/auth/sessions/revoke-others",
        "POST",
        { currentSessionId: window.ZwimaSessionManager?.getCurrentSessionId?.() },
        { authorization: `Bearer ${token}` }
      );
    },

    updateProfile(data) {
      const adapter = getAdapter();
      if (adapter?.updateProfile) {
        return Promise.resolve(adapter.updateProfile(data));
      }
      const token = window.ZwimaJwtManager?.getAccessToken?.();
      if (!token || !window.ZwimaDatabase) {
        const user = { ...this.getCurrentUser(), ...data };
        window.ZwimaStorage?.set("SESSION", user);
        return Promise.resolve(user);
      }
      return window.ZwimaDatabase.queryApi("/api/auth/profile", "POST", data, {
        authorization: `Bearer ${token}`,
      }).then((r) => {
        window.ZwimaStorage.set("SESSION", r.data);
        return r.data;
      });
    },

    resetPassword(payload) {
      const adapter = getAdapter();
      if (adapter?.resetPassword) {
        return Promise.resolve(adapter.resetPassword(payload));
      }
      return window.ZwimaDatabase?.queryApi("/api/auth/reset", "POST", payload).then((r) => r.data);
    },

    hasRole(role) {
      const user = this.getCurrentUser();
      return window.ZwimaPermissionManager?.hasRole?.(user, role) || false;
    },

    hasPermission(permission) {
      const user = this.getCurrentUser();
      return window.ZwimaPermissionManager?.canAccess?.(user, permission) || false;
    },

    checkRole(role) {
      const token = window.ZwimaJwtManager?.getAccessToken?.();
      return window.ZwimaDatabase?.queryApi(`/api/auth/role?role=${encodeURIComponent(role)}`, "GET", null, {
        authorization: `Bearer ${token}`,
      }).then((r) => r.data);
    },

    checkPermission(permission) {
      const token = window.ZwimaJwtManager?.getAccessToken?.();
      return window.ZwimaDatabase?.queryApi(`/api/auth/permissions?permission=${encodeURIComponent(permission)}`, "GET", null, {
        authorization: `Bearer ${token}`,
      }).then((r) => r.data);
    },
  };
})();
