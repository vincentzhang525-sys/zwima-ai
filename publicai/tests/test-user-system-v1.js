#!/usr/bin/env node
/**
 * Sprint 26 — User System V1 automated tests.
 * Uses Node vm + in-memory localStorage (no real provider APIs).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

const PROTECTED_PAGES = [
  "dashboard.html",
  "playground.html",
  "usage.html",
  "credits.html",
  "apikeys.html",
  "settings.html",
];

const ADMIN = { email: "admin@zwima-group.info", password: "admin123" };
const DEMO = { email: "demo@zwima-group.info", password: "demo123" };

function createStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
  };
}

function loadUserSystemVm(storage, pathname = "/dashboard.html") {
  const context = {
    window: {},
    globalThis: {},
    localStorage: storage,
    atob: (s) => Buffer.from(s, "base64").toString("utf8"),
    btoa: (s) => Buffer.from(s, "utf8").toString("base64"),
    ZWIMA_CONFIG: {
      AUTH_PROVIDER: "localStorage",
      JWT_ACCESS_TTL_SEC: 900,
      JWT_REFRESH_TTL_SEC: 604800,
    },
    console,
    setTimeout,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        content: "[Mock provider] Automated test response.",
        model: "gpt-4o",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        latencyMs: 120,
      }),
      headers: { get: () => "application/json" },
    }),
    location: { pathname, search: "", href: `http://127.0.0.1${pathname}` },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);

  const scripts = [
    "utils/constants.js",
    "utils/storage.js",
    "services/userStore.js",
    "auth/jwtManager.js",
    "services/auth/localStorageAuthAdapter.js",
    "services/authService.js",
    "auth/authGuard.js",
    "services/creditsService.js",
    "services/usageService.js",
    "services/apiKeyService.js",
    "services/userService.js",
  ];

  for (const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }

  return context;
}

function installRedirectTrap(ctx, pathname) {
  let redirected = "";
  Object.defineProperty(ctx, "location", {
    configurable: true,
    value: new Proxy(
      { pathname, search: "" },
      {
        set(target, prop, value) {
          if (prop === "href") redirected = String(value);
          target[prop] = value;
          return true;
        },
        get(target, prop) {
          if (prop === "href") return redirected || `http://127.0.0.1${pathname}`;
          return target[prop];
        },
      }
    ),
  });
  return () => redirected;
}

function simulateMockPlaygroundRequest(ctx, { prompt = "User system test prompt", tokens = 42 } = {}) {
  const walletBefore = ctx.ZwimaCreditsService.getWallet().balance;
  const usageBefore = ctx.ZwimaUsageService.getRecords().length;
  const email = ctx.ZwimaAuthService.getCurrentUser()?.email;

  ctx.ZwimaCreditsService.spend(tokens, "Playground: OpenAI · GPT-4o (mock)");
  ctx.ZwimaUsageService.addRecord({
    provider: "OpenAI",
    model: "GPT-4o",
    prompt,
    inputTokens: 12,
    outputTokens: 30,
    totalTokens: tokens,
    estimatedCost: 0.000084,
    remainingCredits: ctx.ZwimaCreditsService.getWallet().balance,
    status: "Success",
  });

  return {
    email,
    walletBefore,
    walletAfter: ctx.ZwimaCreditsService.getWallet().balance,
    usageBefore,
    usageAfter: ctx.ZwimaUsageService.getRecords().length,
    records: ctx.ZwimaUsageService.getRecords(),
  };
}

async function run() {
  const results = [];
  const pass = (name) => results.push({ name, ok: true });
  const fail = (name, err) => results.push({ name, ok: false, err: String(err) });

  try {
    // 1. Default users exist
    {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage);
      ctx.ZwimaUserStore.init();

      const adminUser = ctx.ZwimaUserStore.findByEmail(ADMIN.email);
      const demoUser = ctx.ZwimaUserStore.findByEmail(DEMO.email);

      if (adminUser?.email === ADMIN.email && adminUser.password === ADMIN.password) {
        pass("default user admin@zwima-group.info exists");
      } else {
        fail("default user admin@zwima-group.info exists", "seed record missing or wrong password");
      }

      if (demoUser?.email === DEMO.email && demoUser.password === DEMO.password) {
        pass("default user demo@zwima-group.info exists");
      } else {
        fail("default user demo@zwima-group.info exists", "seed record missing or wrong password");
      }

      await ctx.ZwimaAuthService.login(ADMIN);
      if (ctx.ZwimaAuthService.getCurrentUser()?.email === ADMIN.email) {
        pass("admin@zwima-group.info / admin123 login works");
      } else {
        fail("admin@zwima-group.info / admin123 login works", "login failed");
      }
      await ctx.ZwimaAuthService.logout();

      await ctx.ZwimaAuthService.login(DEMO);
      if (ctx.ZwimaAuthService.getCurrentUser()?.email === DEMO.email) {
        pass("demo@zwima-group.info / demo123 login works");
      } else {
        fail("demo@zwima-group.info / demo123 login works", "login failed");
      }
    }

    // 2. Unauthenticated guard redirects to login.html
    for (const page of PROTECTED_PAGES) {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage, `/${page}`);
      const getRedirect = installRedirectTrap(ctx, `/${page}`);
      ctx.ZwimaAuthService.logout();
      ctx.ZwimaAuthGuard.requireAuth();
      const redirected = getRedirect();
      if (redirected.includes("login.html")) {
        pass(`unauthenticated ${page} redirects to login.html`);
      } else {
        fail(`unauthenticated ${page} redirects to login.html`, redirected || "no redirect");
      }
    }

    // 3. Admin login enters dashboard (authenticated, no login redirect)
    {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage, "/dashboard.html");
      const getRedirect = installRedirectTrap(ctx, "/dashboard.html");
      await ctx.ZwimaAuthService.login(ADMIN);
      const allowed = ctx.ZwimaAuthGuard.requireAuth();
      const redirected = getRedirect();
      if (allowed && ctx.ZwimaAuthService.isAuthenticated() && !redirected.includes("login.html")) {
        pass("admin login allows dashboard access");
      } else {
        fail("admin login allows dashboard access", redirected || "blocked");
      }
    }

    // 4. Dashboard reads current user profile fields
    {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage);
      await ctx.ZwimaAuthService.login(ADMIN);
      const user = ctx.ZwimaAuthService.getCurrentUser();
      const wallet = ctx.ZwimaCreditsService.getWallet();

      const checks = [
        ["email", user.email, ADMIN.email],
        ["company", user.company, "Zwima Technologie GmbH"],
        ["role", user.role, "admin"],
        ["status", user.status, "active"],
        ["credits", wallet.balance, 50000],
      ];

      let allOk = true;
      const errors = [];
      for (const [field, actual, expected] of checks) {
        if (actual !== expected) {
          allOk = false;
          errors.push(`${field}: expected ${expected}, got ${actual}`);
        }
      }

      if (allOk) pass("dashboard reads admin email/company/role/status/credits");
      else fail("dashboard reads admin email/company/role/status/credits", errors.join("; "));
    }

    // 5. Settings profile persists after refresh (re-login)
    {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage);
      await ctx.ZwimaAuthService.login(ADMIN);

      await ctx.ZwimaAuthService.updateProfile({
        company: "ZWIMA Updated GmbH",
        country: "Austria",
      });

      await ctx.ZwimaAuthService.logout();
      await ctx.ZwimaAuthService.login(ADMIN);

      const user = ctx.ZwimaAuthService.getCurrentUser();
      const stored = ctx.ZwimaUserStore.findByEmail(ADMIN.email);

      if (user.company === "ZWIMA Updated GmbH" && user.country === "Austria") {
        pass("settings company/country persist in session after re-login");
      } else {
        fail(
          "settings company/country persist in session after re-login",
          `session company=${user.company}, country=${user.country}`
        );
      }

      if (stored?.company === "ZWIMA Updated GmbH" && stored?.country === "Austria") {
        pass("settings company/country persist in user store after refresh");
      } else {
        fail(
          "settings company/country persist in user store after refresh",
          `store company=${stored?.company}, country=${stored?.country}`
        );
      }
    }

    // 6. Mock playground request updates credits + usage for current user only
    {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage);
      await ctx.ZwimaAuthService.login(ADMIN);

      const result = simulateMockPlaygroundRequest(ctx, {
        prompt: "admin-only playground prompt",
        tokens: 55,
      });

      const creditsReduced = result.walletAfter === result.walletBefore - 55;
      const usageIncreased = result.usageAfter === result.usageBefore + 1;
      const usageKey = `zwima_usage_history_${ADMIN.email}`;
      const walletKey = `zwima_credits_wallet_${ADMIN.email}`;
      const hasUserUsageKey = Boolean(storage.getItem(usageKey));
      const hasUserWalletKey = Boolean(storage.getItem(walletKey));
      const demoUsageKey = `zwima_usage_history_${DEMO.email}`;
      const demoHasUsage = Boolean(storage.getItem(demoUsageKey));

      if (creditsReduced) pass("mock playground reduces credits");
      else fail("mock playground reduces credits", `${result.walletBefore} -> ${result.walletAfter}`);

      if (usageIncreased) pass("mock playground increases usage records");
      else fail("mock playground increases usage records", `${result.usageBefore} -> ${result.usageAfter}`);

      if (hasUserUsageKey && hasUserWalletKey && !demoHasUsage) {
        pass("usage/credits stored only for current admin user");
      } else {
        fail("usage/credits stored only for current admin user", `adminUsage=${hasUserUsageKey}, demoUsage=${demoHasUsage}`);
      }
    }

    // 7. Demo user data isolated from admin
    {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage);

      await ctx.ZwimaAuthService.login(ADMIN);
      simulateMockPlaygroundRequest(ctx, { prompt: "admin secret usage row", tokens: 10 });
      ctx.ZwimaApiKeyService.createKey("admin-secret-key");
      const adminCredits = ctx.ZwimaCreditsService.getWallet().balance;
      const adminUsageCount = ctx.ZwimaUsageService.getRecords().length;
      const adminKeysCount = ctx.ZwimaApiKeyService.getKeys().length;
      await ctx.ZwimaAuthService.logout();

      await ctx.ZwimaAuthService.login(DEMO);
      const demoUsage = ctx.ZwimaUsageService.getRecords();
      const demoKeys = ctx.ZwimaApiKeyService.getKeys();
      const demoCredits = ctx.ZwimaCreditsService.getWallet().balance;

      const noAdminUsage = !demoUsage.some((row) => row.prompt === "admin secret usage row");
      const noAdminKeys = !demoKeys.some((row) => row.name === "admin-secret-key");
      const creditsIndependent = demoCredits === 5000 && demoCredits !== adminCredits;

      if (noAdminUsage) pass("demo cannot see admin usage records");
      else fail("demo cannot see admin usage records", `rows=${demoUsage.length}`);

      if (noAdminKeys) pass("demo cannot see admin API keys");
      else fail("demo cannot see admin API keys", `keys=${demoKeys.length}`);

      if (creditsIndependent) pass("demo credits wallet independent from admin");
      else fail("demo credits wallet independent from admin", `demo=${demoCredits}, admin=${adminCredits}`);

      if (adminUsageCount > 0 && demoUsage.length === 0) {
        pass("demo usage history empty while admin has usage");
      } else {
        fail(
          "demo usage history empty while admin has usage",
          `admin=${adminUsageCount}, demo=${demoUsage.length}`
        );
      }
    }

    // 8. Logout then playground redirects to login.html
    {
      const storage = createStorage();
      const ctx = loadUserSystemVm(storage, "/playground.html");
      const getRedirect = installRedirectTrap(ctx, "/playground.html");

      await ctx.ZwimaAuthService.login(ADMIN);
      await ctx.ZwimaAuthService.logout();

      if (!ctx.ZwimaAuthService.isAuthenticated()) {
        pass("logout clears authenticated session");
      } else {
        fail("logout clears authenticated session", "still authenticated");
      }

      ctx.ZwimaAuthGuard.requireAuth();
      const redirected = getRedirect();
      if (redirected.includes("login.html")) {
        pass("logout后 playground.html redirects to login.html");
      } else {
        fail("logout后 playground.html redirects to login.html", redirected || "no redirect");
      }
    }
  } catch (err) {
    fail("runner", err);
  }

  console.log("\n=== Sprint 26 User System V1 Automated Tests ===\n");
  let passed = 0;
  results.forEach((r) => {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.err ? ` — ${r.err}` : ""}`);
    if (r.ok) passed += 1;
  });
  console.log(`\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
