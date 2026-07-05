(function (root) {
  const PENDING_KEY = "zwima_auth_pending";
  const MOCK_FLAG = "zwima_mock_auth";

  const DEMO_USER = {
    id: "user-admin",
    email: "admin@zwima-group.info",
    password: "password123",
    name: "ZWIMA Admin",
    company: "Zwima Technologie GmbH",
    country: "Germany",
    userType: "Business",
    role: "Admin",
    plan: "Early Access",
    creditsBalance: "12,450",
    contactName: "ZWIMA Admin",
    language: "English",
    timezone: "Europe/Berlin",
    apiKeyCount: 4,
    permissions: ["admin", "api", "billing"],
  };

  function buildUser(data) {
    return {
      id: data.id || `user-${Date.now()}`,
      name: data.name || data.contactName || data.email.split("@")[0],
      email: data.email,
      company: data.company || "Company",
      country: data.country || "Germany",
      userType: data.userType || "Developer",
      role: data.role || "Developer",
      plan: "Early Access",
      creditsBalance: "12,450",
      contactName: data.name || data.email.split("@")[0],
      language: "English",
      timezone: "Europe/Berlin",
      apiKeyCount: 0,
      permissions: ["api"],
      emailVerified: true,
    };
  }

  function establishSession(user) {
    if (root.ZwimaJwtManager?.createTokenPair) {
      root.ZwimaJwtManager.setTokens(root.ZwimaJwtManager.createTokenPair(user));
    }
    if (root.ZwimaStorage) {
      root.ZwimaStorage.set("SESSION", user);
    }
    localStorage.setItem(MOCK_FLAG, "1");
    localStorage.setItem("zwima_mock_session", JSON.stringify(user));
    return user;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  root.ZwimaMockAuth = {
    DEMO_USER,

    isAuthenticated() {
      const token = root.ZwimaJwtManager?.getAccessToken?.();
      if (token && !root.ZwimaJwtManager.isExpired(token)) return true;
      return localStorage.getItem(MOCK_FLAG) === "1";
    },

    getSession() {
      const stored = root.ZwimaStorage?.get("SESSION", null);
      if (stored?.email) return stored;
      try {
        return JSON.parse(localStorage.getItem("zwima_mock_session") || "null");
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

    async signIn(email, password) {
      await delay(280);
      const normalized = String(email || "").trim().toLowerCase();
      const pass = String(password || "");

      if (!normalized || pass.length < 6) {
        throw new Error("Invalid email or password.");
      }

      if (normalized === DEMO_USER.email) {
        if (pass !== DEMO_USER.password) {
          throw new Error("Invalid email or password.");
        }
        return { user: establishSession(buildUser(DEMO_USER)) };
      }

      const pending = this.getPendingRegistration();
      if (pending && pending.email?.toLowerCase() === normalized && pending.password === pass) {
        const user = buildUser(pending);
        localStorage.removeItem(PENDING_KEY);
        return { user: establishSession(user) };
      }

      throw new Error("Invalid email or password. Use demo: admin@zwima-group.info / password123");
    },

    async signUp(payload) {
      await delay(320);
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email || !payload.password || payload.password.length < 6) {
        throw new Error("Please provide a valid company email and password (min 6 characters).");
      }
      if (!payload.company) {
        throw new Error("Company name is required.");
      }
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          email,
          password: payload.password,
          company: payload.company,
          country: payload.country || "Germany",
          userType: payload.userType || "Business",
          name: payload.company,
          emailVerified: false,
        })
      );
      return { pending: true, email };
    },

    async forgotPassword(email) {
      await delay(260);
      if (!String(email || "").trim()) {
        throw new Error("Please enter your email address.");
      }
      return { message: "Password reset email sent (mock). Check your inbox." };
    },

    async verifyEmail(code) {
      await delay(300);
      const pending = this.getPendingRegistration();
      if (!pending) {
        throw new Error("No pending registration found. Please sign up again.");
      }
      const normalized = String(code || "").trim();
      if (!/^\d{6}$/.test(normalized) && normalized !== "000000") {
        throw new Error("Invalid verification code. Use 000000 for mock verification.");
      }
      const user = buildUser({ ...pending, emailVerified: true });
      localStorage.removeItem(PENDING_KEY);
      establishSession(user);
      return { user, verified: true };
    },

    signOut() {
      root.ZwimaJwtManager?.clearTokens?.();
      root.ZwimaStorage?.remove?.("SESSION");
      localStorage.removeItem(MOCK_FLAG);
      localStorage.removeItem("zwima_mock_session");
      localStorage.removeItem(PENDING_KEY);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
