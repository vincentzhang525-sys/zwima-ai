(function (root) {
  const USERS_KEY = "zwima_auth_users";
  const PENDING_KEY = "zwima_auth_pending";
  const RESET_KEY = "zwima_auth_reset";
  const SEEDED_KEY = "zwima_auth_seeded_v1";

  const DEFAULT_USERS = [
    {
      id: "user-admin",
      email: "admin@zwima-group.info",
      password: "admin123",
      name: "ZWIMA Admin",
      company: "Zwima Technologie GmbH",
      country: "Germany",
      role: "admin",
      status: "active",
      plan: "Enterprise",
      initialCredits: 50000,
      emailVerified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "user-demo",
      email: "demo@zwima-group.info",
      password: "demo123",
      name: "Demo Customer",
      company: "Demo Company GmbH",
      country: "Germany",
      role: "customer",
      status: "active",
      plan: "Starter",
      initialCredits: 5000,
      emailVerified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

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

  function seedIfNeeded() {
    if (localStorage.getItem(SEEDED_KEY) === "1") return;
    writeUsers(DEFAULT_USERS.map((user) => ({ ...user })));
    localStorage.setItem(SEEDED_KEY, "1");
  }

  function findByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return readUsers().find((user) => user.email === normalized) || null;
  }

  function saveUser(record) {
    const users = readUsers();
    const email = String(record.email || "").trim().toLowerCase();
    const index = users.findIndex((user) => user.email === email);
    const next = { ...record, email };
    if (index >= 0) users[index] = { ...users[index], ...next };
    else users.push(next);
    writeUsers(users);
    return next;
  }

  function toPublicUser(record) {
    const credits = Number(record.initialCredits) || 0;
    return {
      id: record.id || `user-${Date.now()}`,
      name: record.name || record.company || record.email.split("@")[0],
      email: String(record.email || "").toLowerCase(),
      company: record.company || "Company",
      country: record.country || "Germany",
      role: record.role || "customer",
      status: record.status || "active",
      plan: record.plan || "Starter",
      credits,
      creditsBalance: String(record.creditsBalance ?? credits),
      emailVerified: record.emailVerified !== false,
      contactName: record.name || record.email.split("@")[0],
      language: record.language || "English",
      timezone: record.timezone || "Europe/Berlin",
      apiKeyCount: record.apiKeyCount || 0,
      createdAt: record.createdAt || new Date().toISOString(),
    };
  }

  function ensureUserWorkspace(email, initialCredits) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return;
    const walletKey = `zwima_credits_wallet_${normalized}`;
    if (localStorage.getItem(walletKey)) return;

    const balance = Number(initialCredits) || 1000;
    localStorage.setItem(
      walletKey,
      JSON.stringify({
        balance,
        currency: "EUR",
        transactions: [],
      })
    );
  }

  root.ZwimaUserStore = {
    USERS_KEY,
    PENDING_KEY,
    RESET_KEY,
    DEFAULT_USERS,

    init() {
      seedIfNeeded();
    },

    readUsers,
    writeUsers,
    findByEmail,
    saveUser,
    toPublicUser,
    ensureUserWorkspace,

    getPending() {
      try {
        return JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
      } catch {
        return null;
      }
    },

    setPending(pending) {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    },

    clearPending() {
      localStorage.removeItem(PENDING_KEY);
    },

    setResetRequest(payload) {
      localStorage.setItem(RESET_KEY, JSON.stringify(payload));
    },

    getResetRequest() {
      try {
        return JSON.parse(localStorage.getItem(RESET_KEY) || "null");
      } catch {
        return null;
      }
    },

    clearResetRequest() {
      localStorage.removeItem(RESET_KEY);
    },
  };

  root.ZwimaUserStore.init();
})(typeof window !== "undefined" ? window : globalThis);
