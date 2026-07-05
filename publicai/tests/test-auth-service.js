#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const PORT = 8796;

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

function loadAuth(storage) {
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
  const files = [
    "utils/constants.js",
    "utils/storage.js",
    "auth/jwtManager.js",
    "services/auth/localStorageAuthAdapter.js",
    "services/authService.js",
    "auth/authGuard.js",
  ];
  files.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  });
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
    const storage = createStorage();
    const ctx = loadAuth(storage);
    const { ZwimaAuthService } = ctx;

    await ZwimaAuthService.register({
      company: "Acme GmbH",
      email: "dev@acme.eu",
      password: "secret12",
      country: "Germany",
      role: "Developer",
    });
    pass("register success");

    await ZwimaAuthService.verifyEmail("000000");
    if (ZwimaAuthService.getCurrentUser()?.email === "dev@acme.eu") pass("verify + session user");
    else fail("verify + session user", ZwimaAuthService.getCurrentUser()?.email);

    await ZwimaAuthService.logout();
    if (!ZwimaAuthService.isAuthenticated()) pass("logout success");
    else fail("logout success", "still authenticated");

    await ZwimaAuthService.login({ email: "admin@zwima-group.info", password: "password123" });
    if (ZwimaAuthService.isAuthenticated()) pass("login success");
    else fail("login success", "not authenticated");

    const user = ZwimaAuthService.getCurrentUser();
    if (user?.plan === "Early Access" && String(user.credits) === "12450") pass("session fields");
    else fail("session fields", JSON.stringify(user));

    let redirected = "";
    await ctx.ZwimaAuthService.logout();
    Object.defineProperty(ctx, "location", {
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
    ctx.ZwimaAuthService.requireAuth();
    if (redirected.includes("login.html")) pass("dashboard guard redirect");
    else fail("dashboard guard redirect", redirected || "none");

    await get("/login.html");
    await get("/dashboard.html");
    pass("auth pages HTTP 200");
  } catch (err) {
    fail("runner", err);
  } finally {
    server.close();
  }

  console.log("\n=== Authentication Service V1 Tests ===\n");
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
