#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const PORT = 8795;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function createStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
}

function loadAuthInVm(storage) {
  const context = {
    window: {},
    globalThis: {},
    localStorage: storage,
    atob: (s) => Buffer.from(s, "base64").toString("utf8"),
    btoa: (s) => Buffer.from(s, "utf8").toString("base64"),
    ZWIMA_CONFIG: { AUTH_PROVIDER: "localStorage", JWT_ACCESS_TTL_SEC: 900, JWT_REFRESH_TTL_SEC: 604800 },
    console,
    setTimeout,
    location: { pathname: "/dashboard.html", search: "", href: "" },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  for (const file of [
    "utils/constants.js",
    "utils/storage.js",
    "services/userStore.js",
    "auth/jwtManager.js",
    "services/auth/localStorageAuthAdapter.js",
    "services/authService.js",
    "auth/authGuard.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  return context;
}

function serve(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let filePath = path.join(ROOT, url.pathname === "/" ? "index.html" : url.pathname);
  if (!path.extname(filePath) && !fs.existsSync(filePath)) filePath += ".html";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "text/plain" });
    res.end(data);
  });
}

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${pathname}`, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve(res.statusCode));
    }).on("error", reject);
  });
}

async function run() {
  const server = http.createServer(serve);
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  const results = [];
  const pass = (name) => results.push({ name, ok: true });
  const fail = (name, err) => results.push({ name, ok: false, err: String(err) });

  try {
    for (const page of ["signup.html", "login.html", "forgot-password.html", "verify-email.html", "dashboard.html", "settings.html"]) {
      const status = await get(`/${page}`);
      if (status === 200) pass(`HTTP 200 ${page}`);
      else fail(`HTTP 200 ${page}`, `status ${status}`);
    }

    const storage = createStorage();
    const ctx = loadAuthInVm(storage);
    const { ZwimaAuthService } = ctx;

    if (!ZwimaAuthService.isAuthenticated()) pass("session cleared initially");
    else fail("session cleared initially", "authenticated");

    await ZwimaAuthService.login({ email: "admin@zwima-group.info", password: "admin123" });
    if (ZwimaAuthService.isAuthenticated()) pass("login establishes session");
    else fail("login establishes session", "not authenticated");

    if (storage.getItem("zwima_mock_auth") === "1") pass("localStorage session flag");
    else fail("localStorage session flag", storage.getItem("zwima_mock_auth"));

    if (storage.getItem("zwima_access_token")) pass("localStorage access token");
    else fail("localStorage access token", "missing");

    await ZwimaAuthService.logout();
    if (!ZwimaAuthService.isAuthenticated()) pass("logout clears session");
    else fail("logout clears session", "still authenticated");

    await ZwimaAuthService.register({
      company: "Acme GmbH",
      email: "dev@acme.eu",
      password: "secret12",
      country: "Germany",
      role: "customer",
    });
    await ZwimaAuthService.verifyEmail("000000");
    if (ZwimaAuthService.getCurrentUser()?.email === "dev@acme.eu") pass("signup verify flow");
    else fail("signup verify flow", ZwimaAuthService.getCurrentUser()?.email);

    let redirected = "";
    const guardCtx = loadAuthInVm(createStorage());
    guardCtx.ZwimaAuthService.logout();
    Object.defineProperty(guardCtx, "location", {
      configurable: true,
      value: new Proxy(
        { pathname: "/dashboard.html", search: "" },
        {
          set(target, prop, value) {
            if (prop === "href") redirected = value;
            target[prop] = value;
            return true;
          },
          get(target, prop) {
            if (prop === "href") return redirected || "http://127.0.0.1/dashboard.html";
            return target[prop];
          },
        }
      ),
    });
    guardCtx.ZwimaAuthService.requireAuth();
    if (redirected.includes("login.html")) pass("dashboard guard redirects login");
    else fail("dashboard guard redirects login", redirected || "none");
  } catch (err) {
    fail("runner", err);
  } finally {
    server.close();
  }

  console.log("\n=== Sprint 26 User System V1 Tests ===\n");
  let passed = 0;
  results.forEach((r) => {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.err ? ` — ${r.err}` : ""}`);
    if (r.ok) passed += 1;
  });
  console.log(`\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
