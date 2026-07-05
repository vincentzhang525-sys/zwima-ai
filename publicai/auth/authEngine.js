(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZwimaAuthEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PermissionManager =
    typeof ZwimaPermissionManager !== "undefined" ? ZwimaPermissionManager : require("./permissionManager");
  const JwtManager = typeof ZwimaJwtManager !== "undefined" ? ZwimaJwtManager : require("./jwtManager");

  const DEFAULT_ACCOUNTS = [
    {
      id: "user-admin-1",
      email: "admin@zwima-group.info",
      password: "password123",
      role: "Admin",
      name: "Admin User",
      company: "Zwima Technologie GmbH",
      contactName: "Admin User",
      country: "Germany",
      language: "English",
      timezone: "Europe/Berlin",
      billingEmail: "hello@zwima-group.info",
      vatNumber: "DE321456789",
      plan: "Early Access",
      apiKeyCount: 4,
      creditsBalance: "12,450",
      avatar: "AU",
    },
    {
      id: "user-demo-1",
      email: "alex.weber@company.eu",
      password: "password123",
      role: "Developer",
      name: "Alex Weber",
      company: "Zwima Technologie GmbH",
      contactName: "Alex Weber",
      country: "Germany",
      language: "English",
      timezone: "Europe/Berlin",
      billingEmail: "alex.weber@company.eu",
      vatNumber: "DE321456789",
      plan: "Early Access",
      apiKeyCount: 4,
      creditsBalance: "12,450",
      avatar: "AW",
    },
  ];

  function createAuthEngine(getAuthStore, saveAuthStore) {
    function ensureStore() {
      let store = getAuthStore();
      if (!store?.accounts?.length) {
        store = { accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })), sessions: [], resetTokens: [] };
        saveAuthStore(store);
      }
      return store;
    }

    function publicUser(account) {
      const permissions = PermissionManager.getPermissionsForRole(account.role);
      return {
        id: account.id,
        email: account.email,
        name: account.name,
        company: account.company,
        contactName: account.contactName || account.name,
        country: account.country,
        language: account.language,
        timezone: account.timezone,
        billingEmail: account.billingEmail || account.email,
        vatNumber: account.vatNumber,
        plan: account.plan,
        apiKeyCount: account.apiKeyCount,
        creditsBalance: account.creditsBalance,
        role: account.role,
        permissions,
        avatar: account.avatar || account.name?.slice(0, 2).toUpperCase(),
      };
    }

    function findAccount(email) {
      const store = ensureStore();
      return store.accounts.find((a) => a.email.toLowerCase() === String(email).toLowerCase()) || null;
    }

    function authResponse(account, sessionMeta) {
      const user = publicUser(account);
      const tokens = JwtManager.createTokenPair(user);
      const session = {
        id: `sess-${Date.now()}`,
        userId: user.id,
        refreshToken: tokens.refreshToken,
        device: sessionMeta?.device || "Web Browser",
        location: sessionMeta?.location || "Berlin, DE",
        current: true,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      const store = ensureStore();
      store.sessions = [session, ...store.sessions.filter((s) => s.userId !== user.id)].slice(0, 10);
      saveAuthStore(store);
      return { user, tokens, session, sessions: store.sessions };
    }

    return {
      signIn({ email, password, remember, device, location }) {
        const account = findAccount(email);
        if (!account || account.password !== password) {
          const err = new Error("Invalid email or password");
          err.code = 401;
          throw err;
        }
        return authResponse(account, { device, location, remember });
      },
      signUp(payload) {
        const store = ensureStore();
        if (store.accounts.some((a) => a.email.toLowerCase() === String(payload.email).toLowerCase())) {
          const err = new Error("Email already registered");
          err.code = 409;
          throw err;
        }
        const account = {
          id: `user-${Date.now()}`,
          email: payload.email,
          password: payload.password || "password123",
          role: "Developer",
          name: payload.name,
          company: payload.company,
          contactName: payload.name,
          country: payload.country || "Germany",
          language: "English",
          timezone: "Europe/Berlin",
          billingEmail: payload.email,
          plan: "Early Access",
          apiKeyCount: 0,
          creditsBalance: "0",
          avatar: payload.name?.slice(0, 2).toUpperCase() || "U",
        };
        store.accounts.push(account);
        saveAuthStore(store);
        return authResponse(account, {});
      },
      signOut(refreshToken) {
        const store = ensureStore();
        if (refreshToken) {
          store.sessions = store.sessions.filter((s) => s.refreshToken !== refreshToken);
          saveAuthStore(store);
        }
        return { signedOut: true };
      },
      forgotPassword({ email }) {
        const account = findAccount(email);
        if (!account) return { sent: true };
        const store = ensureStore();
        const token = `reset-${Date.now()}`;
        store.resetTokens.push({ email: account.email, token, expiresAt: Date.now() + 3600000 });
        saveAuthStore(store);
        return { sent: true, resetToken: token };
      },
      resetPassword({ email, password, resetToken }) {
        const store = ensureStore();
        const account = findAccount(email);
        if (!account) {
          const err = new Error("Account not found");
          err.code = 404;
          throw err;
        }
        if (resetToken) {
          const valid = store.resetTokens.find((t) => t.token === resetToken && t.expiresAt > Date.now());
          if (!valid) {
            const err = new Error("Invalid or expired reset token");
            err.code = 400;
            throw err;
          }
          store.resetTokens = store.resetTokens.filter((t) => t.token !== resetToken);
        }
        account.password = password;
        saveAuthStore(store);
        return { reset: true };
      },
      refreshToken(refreshToken) {
        const payload = JwtManager.verify(refreshToken);
        if (!payload || payload.type !== "refresh") {
          const err = new Error("Invalid refresh token");
          err.code = 401;
          throw err;
        }
        const account = ensureStore().accounts.find((a) => a.id === payload.sub);
        if (!account) {
          const err = new Error("User not found");
          err.code = 404;
          throw err;
        }
        const user = publicUser(account);
        const tokens = JwtManager.createTokenPair(user);
        return { user, tokens };
      },
      getMe(accessToken) {
        const payload = JwtManager.verify(accessToken);
        if (!payload) {
          const err = new Error("Unauthorized");
          err.code = 401;
          throw err;
        }
        const account = ensureStore().accounts.find((a) => a.id === payload.sub);
        if (!account) {
          const err = new Error("User not found");
          err.code = 404;
          throw err;
        }
        return publicUser(account);
      },
      getSessions(accessToken) {
        const me = this.getMe(accessToken);
        const store = ensureStore();
        return store.sessions.filter((s) => s.userId === me.id);
      },
      revokeSession(accessToken, sessionId) {
        const me = this.getMe(accessToken);
        const store = ensureStore();
        store.sessions = store.sessions.filter((s) => !(s.userId === me.id && s.id === sessionId));
        saveAuthStore(store);
        return { revoked: true };
      },
      revokeOtherSessions(accessToken, currentSessionId) {
        const me = this.getMe(accessToken);
        const store = ensureStore();
        store.sessions = store.sessions.filter((s) => s.userId !== me.id || s.id === currentSessionId);
        saveAuthStore(store);
        return { count: store.sessions.length };
      },
      checkRole(accessToken, role) {
        const user = this.getMe(accessToken);
        return { allowed: PermissionManager.hasRole(user, role), role: user.role };
      },
      checkPermission(accessToken, permission) {
        const user = this.getMe(accessToken);
        return { allowed: PermissionManager.canAccess(user, permission), permission, role: user.role };
      },
      updateProfile(accessToken, data) {
        const me = this.getMe(accessToken);
        const store = ensureStore();
        const account = store.accounts.find((a) => a.id === me.id);
        Object.assign(account, data);
        saveAuthStore(store);
        return publicUser(account);
      },
      verifyRequest(accessToken) {
        if (!accessToken) {
          const err = new Error("Missing authorization token");
          err.code = 401;
          throw err;
        }
        const token = accessToken.replace(/^Bearer\s+/i, "");
        return this.getMe(token);
      },
    };
  }

  return { createAuthEngine, DEFAULT_ACCOUNTS };
});
