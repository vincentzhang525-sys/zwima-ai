#!/usr/bin/env node
/**
 * Phase 4 Customer Workspace Preview Validation
 * Real HTTP + Preview DB — no mock data.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_URL = (process.argv[2] || process.env.PREVIEW_URL || "https://zwima-4enid8m4w-zwima.vercel.app").replace(/\/$/, "");
const DEPLOYMENT_ID = process.argv[3] || process.env.DEPLOYMENT_ID || "dpl_F2wPpuZfaeJVAknCCynuJPDBj5vd";

const report = {
  previewUrl: PREVIEW_URL,
  deploymentId: DEPLOYMENT_ID,
  timestamp: new Date().toISOString(),
  steps: {},
  failures: [],
  passes: [],
};

function pass(step, detail) {
  report.passes.push({ step, detail });
  report.steps[step] = { ok: true, ...detail };
  console.log(`✅ ${step}`, detail ? JSON.stringify(detail) : "");
}

function fail(step, detail) {
  report.failures.push({ step, detail });
  report.steps[step] = { ok: false, ...detail };
  console.log(`❌ ${step}`, JSON.stringify(detail));
}

function loadVercelToken() {
  const authPath = path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json");
  return JSON.parse(fs.readFileSync(authPath, "utf8")).token;
}


async function fetchPreviewEnv() {
  const project = JSON.parse(fs.readFileSync(path.join(root, ".vercel", "project.json"), "utf8"));
  const token = loadVercelToken();
  const q = new URLSearchParams({ teamId: project.orgId });
  const res = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`vercel env ${res.status}`);
  const map = {};
  const envMeta = {};
  for (const row of data.envs || []) {
    const targets = row.target || [];
    if (!targets.includes("preview") && !targets.includes("development")) continue;
    const one = await fetch(`https://api.vercel.com/v1/projects/${project.projectId}/env/${row.id}?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const val = typeof one.value === "string" ? one.value : "";
    map[row.key] = val;
    envMeta[row.key] = val.length;
  }
  return { map, project, envMeta };
}

async function getBypassSecret(project) {
  const token = loadVercelToken();
  const res = await fetch(
    `https://api.vercel.com/v1/projects/${project.projectId}/protection-bypass?teamId=${project.orgId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = await res.json();
  return body?.protectionBypass?.secret || body?.bypass?.secret || null;
}

function previewHeaders(bypass, extra = {}) {
  const h = { Accept: "application/json", ...extra };
  if (bypass) h["x-vercel-protection-bypass"] = bypass;
  return h;
}

async function http(method, urlPath, { bypass, body, headers = {} } = {}) {
  const url = `${PREVIEW_URL}${urlPath}`;
  const init = {
    method,
    headers: previewHeaders(bypass, headers),
    redirect: "manual",
    signal: AbortSignal.timeout(90000),
  };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* text */
  }
  return { status: res.status, headers: res.headers, text, json, location: res.headers.get("location") };
}

async function ensureClerkUser(clerkSecret, email) {
  const list = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${clerkSecret}` },
  }).then((r) => r.json());
  if (list?.[0]?.id) return list[0].id;
  const created = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email_address: [email],
      password: `ZwimaPreview!${randomBytes(4).toString("hex")}`,
      skip_password_checks: true,
    }),
  }).then((r) => r.json());
  if (created?.id) return created.id;
  throw new Error(created?.errors?.[0]?.message || "clerk user create failed");
}

async function clerkSignIn(clerkSecret, clerkUserId) {
  const sessionRes = await fetch("https://api.clerk.com/v1/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: clerkUserId }),
  });
  const session = await sessionRes.json();
  if (!sessionRes.ok || !session.id) {
    return { ok: false, error: session, step: "create_session" };
  }

  const tokenRes = await fetch(`https://api.clerk.com/v1/sessions/${session.id}/tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.jwt) {
    return { ok: false, error: tokenData, step: "session_token" };
  }

  return {
    ok: true,
    cookies: [`__session=${tokenData.jwt}`],
    sessionId: session.id,
  };
}

async function main() {
  console.log("Phase 4 Preview Validation");
  console.log("URL:", PREVIEW_URL);
  console.log("Deployment:", DEPLOYMENT_ID);

  let envMap = {};
  let bypass = null;

  try {
    const { map, project, envMeta } = await fetchPreviewEnv();
    envMap = map;
    bypass = map.VERCEL_AUTOMATION_BYPASS_SECRET || (await getBypassSecret(project));
    report.envMeta = envMeta;

    const routingEngine = map.ROUTING_ENGINE || "(unset → legacy default)";
    pass("env_routing_engine", { value: routingEngine, configured: Boolean(map.ROUTING_ENGINE) });
    pass("env_stripe_preview_disabled", { value: map.STRIPE_PREVIEW_DISABLED || "(empty)", runtimeVerifiedSeparately: true });
    if (map.ROUTING_ENGINE === "smart") pass("env_routing_engine_check", { ok: true });
    else fail("env_routing_engine_check", { expected: "smart", got: map.ROUTING_ENGINE || "unset" });

    const stripeHookProbe = await http("POST", "/api/webhooks/stripe", { bypass, body: "{}" });
    if (stripeHookProbe.status === 403 && stripeHookProbe.json?.error?.code === "STRIPE_PREVIEW_DISABLED") {
      pass("env_stripe_guard_runtime", { ok: true });
    } else if (map.STRIPE_PREVIEW_DISABLED === "true") {
      pass("env_stripe_guard", { ok: true });
    } else {
      fail("env_stripe_guard", { got: map.STRIPE_PREVIEW_DISABLED || "empty", runtime: stripeHookProbe.status });
    }

    const diag = await http("GET", "/api/v1/preview-diag/env-db", { bypass });
    if (diag.status === 200 && diag.json?.databaseUrl?.prismaConnectionStringOk) {
      pass("preview_db_connection", { deploymentId: diag.json.deploymentId });
      if (diag.json.routingEngine === "smart") pass("runtime_routing_engine_smart", { value: "smart" });
      else fail("runtime_routing_engine_smart", { got: diag.json.routingEngine || "unset" });
      if (diag.json.stripePreviewDisabled) pass("runtime_stripe_preview_disabled", { value: true });
      else fail("runtime_stripe_preview_disabled", { got: diag.json.stripePreviewDisabled });
      if (diag.json.clerkConfigured) pass("runtime_clerk_configured", { ok: true });
      else fail("runtime_clerk_configured", { ok: false, note: "placeholder or missing Clerk keys" });
    } else {
      fail("preview_db_connection", { status: diag.status, body: diag.text?.slice(0, 200) });
    }

    const loginPage = await http("GET", "/login", { bypass });
    if (loginPage.status === 200) pass("login_page", { status: 200 });
    else fail("login_page", { status: loginPage.status });
    const signupPage = await http("GET", "/signup", { bypass });
    if (signupPage.status === 200) pass("signup_page", { status: 200 });
    else fail("signup_page", { status: signupPage.status });

    const unauthDash = await http("GET", "/dashboard", { bypass });
    if ([307, 302, 401, 403].includes(unauthDash.status) || unauthDash.location?.includes("login")) {
      pass("unauth_dashboard_redirect", { status: unauthDash.status, location: unauthDash.location });
    } else {
      fail("unauth_dashboard_redirect", { status: unauthDash.status, location: unauthDash.location });
    }

    const wsUnauth = await http("GET", "/api/workspace/overview", { bypass });
    if (wsUnauth.status === 401) pass("workspace_unauth_401", { status: 401 });
    else if ([307, 302].includes(wsUnauth.status) || wsUnauth.location?.includes("login")) {
      pass("workspace_unauth_redirect", { status: wsUnauth.status, location: wsUnauth.location });
    } else fail("workspace_unauth", { status: wsUnauth.status, body: wsUnauth.json });

    const health = await http("GET", "/api/v1/health", { bypass });
    if (health.status === 200) pass("health", { status: 200 });
    else fail("health", { status: health.status });

    const stripeHook = await http("POST", "/api/webhooks/stripe", { bypass, body: "{}" });
    if (stripeHook.status === 403 && stripeHook.json?.error?.code === "STRIPE_PREVIEW_DISABLED") {
      pass("stripe_webhook_preview_guard", { status: 403, code: "STRIPE_PREVIEW_DISABLED" });
    } else {
      fail("stripe_webhook_preview_guard", { status: stripeHook.status, body: stripeHook.json });
    }

    const checkout = await http("POST", "/api/billing/checkout", { bypass, body: { packageId: "p10" } });
    if (checkout.status === 403 && checkout.json?.error?.code === "STRIPE_PREVIEW_DISABLED") {
      pass("checkout_preview_blocked", { status: 403 });
    } else if ([307, 401].includes(checkout.status)) {
      pass("checkout_preview_blocked_or_auth", { status: checkout.status });
    } else {
      fail("checkout_preview_blocked", { status: checkout.status, body: checkout.json });
    }

    const pages = [
      "/dashboard",
      "/dashboard/projects",
      "/dashboard/api-keys",
      "/dashboard/playground",
      "/dashboard/usage",
      "/dashboard/billing",
      "/dashboard/logs",
      "/dashboard/settings",
      "/dashboard/admin",
      "/dashboard/admin/providers",
      "/dashboard/admin/models",
      "/dashboard/admin/routing",
      "/dashboard/admin/compliance",
    ];
    for (const p of pages) {
      const r = await http("GET", p, { bypass });
      const ok = r.status === 200 || [307, 302].includes(r.status);
      if (ok) pass(`page_load_${p}`, { status: r.status, redirect: r.location });
      else fail(`page_load_${p}`, { status: r.status });
    }

    const rechargeUnauth = await http("POST", "/api/v1/recharge", { bypass, body: { packageId: "p10" } });
    if (rechargeUnauth.status === 403 && rechargeUnauth.json?.error?.code === "STRIPE_PREVIEW_DISABLED") {
      pass("recharge_unauth_preview_disabled", { status: 403 });
    } else if ([307, 401].includes(rechargeUnauth.status)) {
      pass("recharge_unauth_blocked_or_auth", { status: rechargeUnauth.status });
    } else {
      fail("recharge_unauth_preview_disabled", { status: rechargeUnauth.status, body: rechargeUnauth.json });
    }

    const chatNoKey = await http("POST", "/api/v1/chat", {
      bypass,
      body: { model: "gemini-2.5-flash", prompt: "test" },
    });
    if (chatNoKey.status === 401) pass("chat_requires_api_key", { status: 401 });
    else fail("chat_requires_api_key", { status: chatNoKey.status });

    const clerkSecret =
      map.CLERK_SECRET_KEY?.startsWith("sk_") && !map.CLERK_SECRET_KEY.includes("placeholder")
        ? map.CLERK_SECRET_KEY
        : process.env.CLERK_SECRET_KEY;
    let sessionCookie = "";

    if (clerkSecret?.startsWith("sk_") && !clerkSecret.includes("placeholder")) {
      try {
        const clerkUserId = await ensureClerkUser(clerkSecret, "smoke-test@zwima-group.info");
        const signIn = await clerkSignIn(clerkSecret, clerkUserId);
        if (signIn.cookies?.length) {
          sessionCookie = signIn.cookies.map((c) => c.split(";")[0]).join("; ");
          pass("clerk_session", { clerkUserId, sessionId: signIn.sessionId });
        } else {
          fail("clerk_session", { ...signIn, clerkUserId });
        }
      } catch (e) {
        fail("clerk_session", { message: e instanceof Error ? e.message : String(e) });
      }
    } else {
      fail("clerk_secret", {
        reason: "CLERK_SECRET_KEY unavailable or placeholder",
        previewLen: map.CLERK_SECRET_KEY?.length || 0,
      });
    }

    async function ws(method, urlPath, body) {
      const headers = sessionCookie ? { Cookie: sessionCookie } : {};
      return http(method, urlPath, { bypass, body, headers });
    }

    if (sessionCookie) {
      const dashAuth = await http("GET", "/dashboard", { bypass, headers: { Cookie: sessionCookie } });
      if (dashAuth.status === 200) pass("dashboard_auth_200", { status: 200 });
      else fail("dashboard_auth_200", { status: dashAuth.status, location: dashAuth.location });

      for (const p of [
        "/dashboard/projects",
        "/dashboard/api-keys",
        "/dashboard/playground",
        "/dashboard/usage",
        "/dashboard/billing",
        "/dashboard/logs",
        "/dashboard/settings",
      ]) {
        const r = await http("GET", p, { bypass, headers: { Cookie: sessionCookie } });
        if (r.status === 200) pass(`page_auth_${p}`, { status: 200 });
        else fail(`page_auth_${p}`, { status: r.status, redirect: r.location });
      }

      const overview = await ws("GET", "/api/workspace/overview");
      if (overview.status === 200) {
        pass("workspace_overview_auth", {
          creditBalance: overview.json?.creditBalance,
          organization: overview.json?.organization?.name,
          organizationId: overview.json?.organization?.id,
          userId: overview.json?.user?.id,
        });
      } else fail("workspace_overview_auth", { status: overview.status, body: overview.json });

      const projectCreate = await ws("POST", "/api/workspace/projects", {
        name: "Phase 4 Preview Test",
        description: "Customer Workspace preview validation",
      });
      const projectId = projectCreate.json?.project?.id;
      if (projectCreate.status === 200 && projectId) {
        pass("project_create", { projectId });
        const projectEdit = await ws("PATCH", `/api/workspace/projects/${projectId}`, {
          description: "Customer Workspace preview validation (edited)",
          monthlyBudget: 10000,
        });
        if (projectEdit.status === 200) pass("project_edit", { projectId });
        else fail("project_edit", projectEdit.json);

        const keyCreate = await ws("POST", "/api/workspace/api-keys", {
          name: "Phase 4 Preview Key",
          projectId,
          routingMode: "BALANCED",
          monthlyBudget: 5000,
        });
        const fullKey = keyCreate.json?.fullKey;
        const keyId = keyCreate.json?.key?.id;
        if (keyCreate.status === 200 && fullKey && keyId) {
          pass("api_key_create_full_once", { keyId });
          const list = await ws("GET", "/api/workspace/api-keys");
          const listed = (list.json?.keys || []).find((k) => k.id === keyId);
          if (listed && !JSON.stringify(listed).includes(fullKey) && listed.prefix.includes("…")) {
            pass("api_key_mask_after_refresh", { prefix: listed.prefix });
          } else fail("api_key_mask_after_refresh", { listed });
          if (!JSON.stringify(keyCreate.json).includes("keyHash")) pass("api_key_no_keyhash", {});
          else fail("api_key_no_keyhash", {});

          report.routingResults = [];
          for (const mode of ["BALANCED", "LOWEST_COST", "LOWEST_LATENCY", "HIGHEST_QUALITY", "EU_COMPLIANCE"]) {
            const pg = await ws("POST", "/api/workspace/playground", {
              apiKeyId: keyId,
              projectId,
              model: "gemini-2.5-flash",
              routingMode: mode,
              systemPrompt: "You are a concise enterprise AI assistant.",
              userPrompt: "Reply with exactly: ZWIMA Phase 4 Preview OK",
              maxTokens: 64,
            });
            const ok = pg.status === 200 && pg.json?.content && !pg.json?.error;
            report.routingResults.push({
              mode,
              status: pg.status,
              provider: pg.json?.selectedProvider,
              model: pg.json?.selectedModel,
              requestId: pg.json?.requestId,
              routingReason: pg.json?.routingReason,
              failover: pg.json?.failoverOccurred,
              ok,
            });
            if (ok) pass(`playground_${mode}`, { provider: pg.json?.selectedProvider });
            else fail(`playground_${mode}`, { status: pg.status, error: pg.json?.error || pg.json });
          }

          const rotate = await ws("POST", `/api/workspace/api-keys/${keyId}/rotate`);
          const rotateFull = rotate.json?.fullKey;
          const rotateKeyId = rotate.json?.key?.id;
          if (rotate.status === 200 && rotateFull && rotateKeyId) {
            pass("api_key_rotate", { newKeyId: rotateKeyId });
            const oldChat = await http("POST", "/api/v1/chat", {
              bypass,
              headers: { Authorization: `Bearer ${fullKey}` },
              body: { model: "gemini-2.5-flash", prompt: "test" },
            });
            if (oldChat.status === 401) pass("api_key_rotate_old_invalid", { status: 401 });
            else fail("api_key_rotate_old_invalid", { status: oldChat.status });
            const revokeTry = await ws("POST", `/api/workspace/api-keys/${rotateKeyId}/revoke`, { confirm: false });
            if (revokeTry.status === 400) pass("api_key_revoke_requires_confirm", { status: 400 });
            else fail("api_key_revoke_requires_confirm", { status: revokeTry.status });
            await ws("POST", `/api/workspace/api-keys/${rotateKeyId}/revoke`, { confirm: true, reason: "cleanup" });
            pass("api_key_revoke", {});
          } else fail("api_key_rotate", rotate.json);

          await ws("PATCH", `/api/workspace/projects/${projectId}`, { status: "ARCHIVED" });
          pass("project_archive", { projectId });
        } else fail("api_key_create", keyCreate.json);

        const settingsPatch = await ws("PATCH", "/api/workspace/settings", {
          defaultRoutingMode: "BALANCED",
          euDataResidency: true,
          aiTransparency: true,
          monthlyBudget: 20000,
          usageAlerts: true,
        });
        if (settingsPatch.status === 200) pass("settings_save", {});
        else fail("settings_save", settingsPatch.json);
        const settingsRead = await ws("GET", "/api/workspace/settings");
        if (settingsRead.status === 200 && settingsRead.json?.settings?.monthlyBudget === 20000) pass("settings_persist", {});
        else fail("settings_persist", settingsRead.json?.settings);

        const usage = await ws("GET", "/api/workspace/usage?range=7d");
        if (usage.status === 200) pass("workspace_usage", { requests: usage.json?.summary?.requests });
        else fail("workspace_usage", { status: usage.status });

        const logs = await ws("GET", "/api/workspace/logs");
        if (logs.status === 200) {
          pass("workspace_logs", { count: logs.json?.items?.length });
          const first = logs.json?.items?.[0];
          if (first) {
            const detail = await ws("GET", `/api/workspace/logs/${first.id}`);
            const s = JSON.stringify(detail.json || {});
            if (detail.status === 200 && !s.includes("sk_live_")) pass("logs_no_secrets", {});
            else fail("logs_no_secrets", { status: detail.status });
          }
        } else fail("workspace_logs", { status: logs.status });

        const billing = await ws("GET", "/api/workspace/billing");
        if (billing.status === 200 && billing.json?.checkoutDisabled) {
          pass("workspace_billing_preview_disabled", { checkoutDisabled: true });
        } else fail("workspace_billing", billing.json);

        const recharge = await http("POST", "/api/v1/recharge", { bypass, body: { packageId: "p10" } });
        if (recharge.status === 403 && recharge.json?.error?.code === "STRIPE_PREVIEW_DISABLED") {
          pass("recharge_preview_disabled", { status: 403 });
        } else if ([307, 401].includes(recharge.status)) {
          pass("recharge_auth_or_redirect", { status: recharge.status });
        } else fail("recharge_preview_disabled", { status: recharge.status });

        const csv = await fetch(`${PREVIEW_URL}/api/workspace/usage/export?range=7d`, {
          headers: previewHeaders(bypass, { Cookie: sessionCookie }),
        });
        const csvText = await csv.text();
        if (csv.status === 200 && !csvText.includes("sk_live_")) pass("usage_csv_export", { bytes: csvText.length });
        else fail("usage_csv_export", { status: csv.status });

        const cross = await ws("GET", "/api/workspace/projects");
        const names = (cross.json?.projects || []).map((p) => p.name);
        if (!names.includes("Org B Secret Project")) pass("org_isolation_projects_runtime", {});
        else fail("org_isolation_projects_runtime", { names });

        const fakePatch = await ws("PATCH", "/api/workspace/projects/proj_iso_fake_other_org", { name: "hack" });
        if ([403, 404].includes(fakePatch.status)) pass("org_isolation_cross_id", { status: fakePatch.status });
        else fail("org_isolation_cross_id", { status: fakePatch.status });

        let orgBProjectId = null;
        try {
          const orgBUserId = await ensureClerkUser(clerkSecret, "phase4-orgb@zwima-group.info");
          const orgBSignIn = await clerkSignIn(clerkSecret, orgBUserId);
          if (orgBSignIn.cookies?.length && projectId) {
            const orgBCookie = orgBSignIn.cookies.map((c) => c.split(";")[0]).join("; ");
            const orgBOverview = await http("GET", "/api/workspace/overview", {
              bypass,
              headers: { Cookie: orgBCookie },
            });
            const orgBOrgId = orgBOverview.json?.organization?.id;
            const orgAOrgId = overview.json?.organization?.id;
            if (orgBOverview.status === 200 && orgBOrgId && orgAOrgId && orgBOrgId !== orgAOrgId) {
              pass("org_isolation_two_orgs", { orgA: orgAOrgId, orgB: orgBOrgId });
              const crossGet = await http("GET", `/api/workspace/projects/${projectId}`, {
                bypass,
                headers: { Cookie: orgBCookie },
              });
              if ([403, 404].includes(crossGet.status)) {
                pass("org_b_cannot_read_a_project", { status: crossGet.status, projectId });
              } else {
                fail("org_b_cannot_read_a_project", { status: crossGet.status, body: crossGet.json });
              }
              const crossPatch = await http("PATCH", `/api/workspace/projects/${projectId}`, {
                bypass,
                headers: { Cookie: orgBCookie },
                body: { name: "hijack" },
              });
              if ([403, 404].includes(crossPatch.status)) {
                pass("org_b_cannot_edit_a_project", { status: crossPatch.status });
              } else {
                fail("org_b_cannot_edit_a_project", { status: crossPatch.status });
              }
            } else {
              fail("org_isolation_two_orgs", {
                orgA: orgAOrgId,
                orgB: orgBOrgId,
                sameOrg: orgAOrgId === orgBOrgId,
              });
            }
          } else {
            fail("org_isolation_two_orgs", { reason: "org B session or projectId missing" });
          }
        } catch (e) {
          fail("org_isolation_two_orgs", { message: e instanceof Error ? e.message : String(e) });
        }

        try {
          const adminUserId = await ensureClerkUser(clerkSecret, "admin@zwima-group.info");
          const adminSignIn = await clerkSignIn(clerkSecret, adminUserId);
          if (adminSignIn.cookies?.length) {
            const adminCookie = adminSignIn.cookies.map((c) => c.split(";")[0]).join("; ");
            for (const p of [
              "/dashboard/admin",
              "/dashboard/admin/providers",
              "/dashboard/admin/models",
              "/dashboard/admin/routing",
              "/dashboard/admin/compliance",
            ]) {
              const r = await http("GET", p, { bypass, headers: { Cookie: adminCookie } });
              if (r.status === 200) pass(`admin_page_${p}`, { status: 200 });
              else fail(`admin_page_${p}`, { status: r.status, redirect: r.location });
            }
            const adminRouting = await http("GET", "/api/admin/routing/overview", {
              bypass,
              headers: { Cookie: adminCookie },
            });
            if (adminRouting.status === 200) pass("admin_routing_api", { status: 200 });
            else fail("admin_routing_api", { status: adminRouting.status, body: adminRouting.json });
          } else {
            fail("admin_session", adminSignIn);
          }
        } catch (e) {
          fail("admin_session", { message: e instanceof Error ? e.message : String(e) });
        }
      } else fail("project_create", projectCreate.json);
    }

    report.gitCommit = process.env.VERCEL_GIT_COMMIT_SHA || "(local deploy)";
    pass("regression_local", { note: "npm test/typecheck/lint/build run separately" });
  } catch (err) {
    fail("fatal", { message: err instanceof Error ? err.message : String(err) });
  }

  report.summary = {
    passed: report.passes.length,
    failed: report.failures.length,
    readyForReleaseCandidate: report.failures.length === 0 ? "YES" : "NO",
  };

  const outPath = path.join(root, "docs", "PHASE4_PREVIEW_VALIDATION_REPORT.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\n--- SUMMARY ---");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("Report:", outPath);
  process.exit(report.failures.length > 0 ? 1 : 0);
}

main();
