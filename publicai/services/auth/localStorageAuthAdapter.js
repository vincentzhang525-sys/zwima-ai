(function (root) {
  const MOCK_FLAG = "zwima_mock_auth";
  const store = () => root.ZwimaUserStore;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function establishSession(user) {
    const normalized = store().toPublicUser(user);
    store().ensureUserWorkspace(normalized.email, normalized.credits);

    const walletRaw = localStorage.getItem(`zwima_credits_wallet_${normalized.email}`);
    if (walletRaw) {
      try {
        const wallet = JSON.parse(walletRaw);
        normalized.credits = Number(wallet.balance) || normalized.credits;
        normalized.creditsBalance = String(normalized.credits);
      } catch {
        // keep defaults
      }
    }

    if (root.ZwimaJwtManager?.createTokenPair) {
      root.ZwimaJwtManager.setTokens(
        root.ZwimaJwtManager.createTokenPair({
          ...normalized,
          permissions: normalized.role === "admin" ? ["api", "admin"] : ["api"],
        })
      );
    }
    if (root.ZwimaStorage) {
      root.ZwimaStorage.set("SESSION", normalized);
    }
    localStorage.setItem(MOCK_FLAG, "1");
    localStorage.setItem("zwima_mock_session", JSON.stringify(normalized));
    return normalized;
  }

  function clearSession() {
    root.ZwimaJwtManager?.clearTokens?.();
    root.ZwimaStorage?.remove?.("SESSION");
    localStorage.removeItem(MOCK_FLAG);
    localStorage.removeItem("zwima_mock_session");
  }

  function assertActive(user) {
    if (String(user.status || "active").toLowerCase() === "suspended") {
      throw new Error("This account has been suspended. Please contact support.");
    }
  }

  root.ZwimaLocalStorageAuthAdapter = {
    name: "localStorage",

    isAuthenticated() {
      const token = root.ZwimaJwtManager?.getAccessToken?.();
      if (token && !root.ZwimaJwtManager.isExpired(token)) return true;
      return localStorage.getItem(MOCK_FLAG) === "1";
    },

    getCurrentUser() {
      const stored = root.ZwimaStorage?.get("SESSION", null);
      if (stored?.email) return store().toPublicUser(stored);
      try {
        const raw = JSON.parse(localStorage.getItem("zwima_mock_session") || "null");
        return raw ? store().toPublicUser(raw) : null;
      } catch {
        return null;
      }
    },

    getPendingRegistration() {
      return store().getPending();
    },

    async register(payload) {
      await delay(280);
      store().init();

      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!payload.company) throw new Error("Company name is required.");
      if (!email || password.length < 6) {
        throw new Error("Please provide a valid email and password (min 6 characters).");
      }
      if (store().findByEmail(email)) {
        throw new Error("An account with this email already exists.");
      }

      const pending = {
        email,
        password,
        company: payload.company,
        country: payload.country || "Germany",
        role: "customer",
        status: "active",
        name: payload.name || payload.company,
        plan: "Starter",
        initialCredits: 1000,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      };
      store().setPending(pending);
      return { pending: true, email };
    },

    async login(credentials) {
      await delay(260);
      store().init();

      const email = String(credentials.email || "").trim().toLowerCase();
      const password = String(credentials.password || "");
      if (!email || password.length < 6) {
        throw new Error("Invalid email or password.");
      }

      const record = store().findByEmail(email);
      if (!record || record.password !== password) {
        throw new Error("Invalid email or password.");
      }

      assertActive(record);
      return { user: establishSession(record) };
    },

    async logout() {
      await delay(120);
      clearSession();
      return { success: true };
    },

    async forgotPassword(email) {
      await delay(220);
      store().init();
      const normalized = String(email || "").trim().toLowerCase();
      if (!normalized) throw new Error("Please enter your email address.");

      const user = store().findByEmail(normalized);
      if (!user) {
        return {
          message: "If an account exists for this email, a reset code has been issued (mock). Use code 000000.",
        };
      }

      store().setResetRequest({
        email: normalized,
        code: "000000",
        requestedAt: new Date().toISOString(),
      });

      return {
        message: "Password reset code issued (mock). Use code 000000 on the reset form.",
        email: normalized,
      };
    },

    async resetPassword(payload) {
      await delay(240);
      store().init();
      const email = String(payload.email || "").trim().toLowerCase();
      const code = String(payload.code || "").trim();
      const password = String(payload.password || "");
      const request = store().getResetRequest();

      if (!email || password.length < 6) {
        throw new Error("Please provide a valid email and new password (min 6 characters).");
      }
      if (!/^\d{6}$/.test(code) && code !== "000000") {
        throw new Error("Invalid reset code. Use 000000 for mock reset.");
      }
      if (request && request.email !== email) {
        throw new Error("Reset request does not match this email.");
      }

      const user = store().findByEmail(email);
      if (!user) throw new Error("No account found for this email.");

      const updated = store().saveUser({ ...user, password });
      store().clearResetRequest();
      return { success: true, message: "Password updated successfully." , user: store().toPublicUser(updated) };
    },

    async verifyEmail(code) {
      await delay(260);
      const pending = store().getPending();
      if (!pending) throw new Error("No pending registration found. Please sign up again.");
      const normalized = String(code || "").trim();
      if (!/^\d{6}$/.test(normalized) && normalized !== "000000") {
        throw new Error("Invalid verification code. Use 000000 for mock verification.");
      }

      const user = store().saveUser({
        ...pending,
        id: `user-${Date.now()}`,
        emailVerified: true,
      });
      store().clearPending();
      store().ensureUserWorkspace(user.email, user.initialCredits);
      return { user: establishSession(user), verified: true };
    },

    async updateProfile(data) {
      await delay(180);
      const current = this.getCurrentUser();
      if (!current?.email) throw new Error("Not signed in.");

      const record = store().findByEmail(current.email);
      if (!record) throw new Error("User record not found.");

      const updated = store().saveUser({
        ...record,
        company: data.company ?? record.company,
        country: data.country ?? record.country,
        name: data.name ?? record.name ?? record.company,
        language: data.language ?? record.language,
        timezone: data.timezone ?? record.timezone,
      });

      const sessionUser = establishSession(updated);
      return sessionUser;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
