(function (root) {
  const USERS_KEY = "zwima_auth_users";
  const PENDING_KEY = "zwima_auth_pending";
  const MOCK_FLAG = "zwima_mock_auth";

  const DEMO_ACCOUNT = {
    email: "admin@zwima-group.info",
    password: "password123",
    user: {
      id: "user-admin",
      email: "admin@zwima-group.info",
      name: "ZWIMA Admin",
      company: "Zwima Technologie GmbH",
      country: "Germany",
      role: "Admin",
      plan: "Early Access",
      credits: 12450,
      creditsBalance: "12450",
      emailVerified: true,
    },
  };

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function readUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function normalizeUser(data) {
    const credits = data.credits ?? 12450;
    return {
      id: data.id || `user-${Date.now()}`,
      name: data.name || data.company || data.email.split("@")[0],
      email: String(data.email || "").toLowerCase(),
      company: data.company || "Company",
      country: data.country || "Germany",
      role: data.role || "Developer",
      plan: data.plan || "Early Access",
      credits,
      creditsBalance: String(data.creditsBalance ?? credits),
      emailVerified: data.emailVerified !== false,
      contactName: data.name || data.email.split("@")[0],
      language: data.language || "English",
      timezone: data.timezone || "Europe/Berlin",
      apiKeyCount: data.apiKeyCount || 0,
    };
  }

  function establishSession(user) {
    const normalized = normalizeUser(user);
    if (root.ZwimaJwtManager?.createTokenPair) {
      root.ZwimaJwtManager.setTokens(
        root.ZwimaJwtManager.createTokenPair({ ...normalized, permissions: ["api"] })
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

  root.ZwimaLocalStorageAuthAdapter = {
    name: "localStorage",

    isAuthenticated() {
      const token = root.ZwimaJwtManager?.getAccessToken?.();
      if (token && !root.ZwimaJwtManager.isExpired(token)) return true;
      return localStorage.getItem(MOCK_FLAG) === "1";
    },

    getCurrentUser() {
      const stored = root.ZwimaStorage?.get("SESSION", null);
      if (stored?.email) return normalizeUser(stored);
      try {
        const raw = JSON.parse(localStorage.getItem("zwima_mock_session") || "null");
        return raw ? normalizeUser(raw) : null;
      } catch {
        return null;
      }
    },

    getPendingRegistration() {
      try {
        return JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
      } catch {
        return null;
      }
    },

    async register(payload) {
      await delay(280);
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!payload.company) throw new Error("Company name is required.");
      if (!email || password.length < 6) {
        throw new Error("Please provide a valid email and password (min 6 characters).");
      }
      if (email === DEMO_ACCOUNT.email) {
        throw new Error("This email is already registered.");
      }
      const exists = readUsers().some((u) => u.email === email);
      if (exists) throw new Error("An account with this email already exists.");

      const pending = {
        email,
        password,
        company: payload.company,
        country: payload.country || "Germany",
        role: payload.role || "Business",
        name: payload.company,
        emailVerified: false,
      };
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      return { pending: true, email };
    },

    async login(credentials) {
      await delay(260);
      const email = String(credentials.email || "").trim().toLowerCase();
      const password = String(credentials.password || "");
      if (!email || password.length < 6) {
        throw new Error("Invalid email or password.");
      }

      if (email === DEMO_ACCOUNT.email) {
        if (password !== DEMO_ACCOUNT.password) {
          throw new Error("Invalid email or password.");
        }
        return { user: establishSession(DEMO_ACCOUNT.user) };
      }

      const record = readUsers().find((u) => u.email === email);
      if (record && record.password === password) {
        return { user: establishSession(record) };
      }

      throw new Error("Invalid email or password.");
    },

    async logout() {
      await delay(120);
      clearSession();
      return { success: true };
    },

    async forgotPassword(email) {
      await delay(220);
      if (!String(email || "").trim()) {
        throw new Error("Please enter your email address.");
      }
      return { message: "Password reset email sent (mock). Check your inbox." };
    },

    async verifyEmail(code) {
      await delay(260);
      const pending = this.getPendingRegistration();
      if (!pending) throw new Error("No pending registration found. Please sign up again.");
      const normalized = String(code || "").trim();
      if (!/^\d{6}$/.test(normalized) && normalized !== "000000") {
        throw new Error("Invalid verification code. Use 000000 for mock verification.");
      }

      const user = normalizeUser({ ...pending, emailVerified: true });
      const users = readUsers();
      users.push({ ...user, password: pending.password });
      writeUsers(users);
      localStorage.removeItem(PENDING_KEY);
      establishSession(user);
      return { user, verified: true };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
