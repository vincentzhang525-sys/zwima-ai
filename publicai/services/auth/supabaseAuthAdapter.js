(function (root) {
  function applySession(result, meta = {}) {
    const user = result.user;
    const session = result.session;
    if (!user || !session) throw new Error("Invalid auth response");

    root.ZwimaStorage?.set?.("SESSION", user);
    root.ZwimaStorage?.setRaw?.("ACCESS_TOKEN", session.access_token);
    root.ZwimaStorage?.setRaw?.("REFRESH_TOKEN", session.refresh_token);
    if (session.expires_at) {
      root.ZwimaStorage?.setRaw?.("TOKEN_EXPIRES_AT", String(session.expires_at * 1000));
    }
    root.ZwimaSessionManager?.rememberLogin?.(Boolean(meta.remember));
    root.ZwimaSessionManager?.registerSession?.(
      root.ZwimaSessionManager?.buildSession?.(user, {
        device: "Web Browser",
        location: "Production",
      }) || { id: `sess-${Date.now()}`, userId: user.id, lastActive: new Date().toISOString() }
    );
    localStorage.setItem("zwima_mock_auth", "1");
    localStorage.setItem("zwima_mock_session", JSON.stringify(user));
    return user;
  }

  function clearSession() {
    root.ZwimaStorage?.remove?.("SESSION");
    root.ZwimaStorage?.remove?.("ACCESS_TOKEN");
    root.ZwimaStorage?.remove?.("REFRESH_TOKEN");
    root.ZwimaStorage?.remove?.("TOKEN_EXPIRES_AT");
    localStorage.removeItem("zwima_mock_auth");
    localStorage.removeItem("zwima_mock_session");
  }

  root.ZwimaSupabaseAuthAdapter = {
    name: "supabase",

    isAuthenticated() {
      return Boolean(root.ZwimaStorage?.getRaw?.("ACCESS_TOKEN"));
    },

    getCurrentUser() {
      return root.ZwimaStorage?.get?.("SESSION", null);
    },

    getPendingRegistration() {
      return null;
    },

    async register(payload) {
      const result = await root.ZwimaSupabaseApi.apiFetch("/api/user/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.pending) return result;
      return { user: applySession(result, { remember: Boolean(credentials?.remember) }) };
    },

    async login(credentials) {
      const result = await root.ZwimaSupabaseApi.apiFetch("/api/user/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      return { user: applySession(result) };
    },

    async logout() {
      clearSession();
      return { success: true };
    },

    async forgotPassword(payload) {
      const email = typeof payload === "string" ? payload : payload?.email;
      return root.ZwimaSupabaseApi.apiFetch("/api/user/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },

    async resetPassword() {
      throw new Error("Password reset is managed in Supabase Auth.");
    },

    async verifyEmail() {
      return { verified: true };
    },

    async updateProfile(data) {
      const result = await root.ZwimaSupabaseApi.apiFetch("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      root.ZwimaStorage?.set?.("SESSION", result.user);
      return result.user;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
