import type { BrowserContext, Page } from "@playwright/test";

const GOOGLE_BUTTON = [
  /continue with google/i,
  /^google$/i,
  /sign in with google/i,
];

export async function findGoogleOAuthControl(page: Page) {
  for (const pattern of GOOGLE_BUTTON) {
    const button = page.getByRole("button", { name: pattern });
    if (await button.first().isVisible().catch(() => false)) return button.first();

    const link = page.getByRole("link", { name: pattern });
    if (await link.first().isVisible().catch(() => false)) return link.first();
  }

  const clerkGoogle = page.locator(
    '.cl-socialButtonsBlockButtonGoogle, [data-provider="google"], [data-provider="oauth_google"]',
  );
  if (await clerkGoogle.first().isVisible().catch(() => false)) return clerkGoogle.first();

  const textMatch = page.locator("button, a, [role='button']").filter({ hasText: /continue with google/i });
  if (await textMatch.first().isVisible().catch(() => false)) return textMatch.first();

  return null;
}

export async function tryClerkProgrammaticGoogle(page: Page): Promise<boolean> {
  console.log("Trying Clerk programmatic Google OAuth redirect…");
  const result = await page.evaluate(async () => {
    const clerk = window.Clerk;
    if (!clerk) return { ok: false, reason: "Clerk not loaded" };
    try {
      await clerk.load();
      if (!clerk.client) return { ok: false, reason: "Clerk client unavailable" };
      const signIn = await clerk.client.signIn.create({});
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/dashboard`,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  });
  if (!result.ok) {
    console.log(`Clerk programmatic OAuth unavailable: ${result.reason}`);
    return false;
  }
  console.log("Redirecting to Google via Clerk OAuth…");
  return true;
}

export async function clickGoogleOAuth(page: Page, context: BrowserContext): Promise<boolean> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1_500);

  let control = await findGoogleOAuthControl(page);
  if (!control) {
    control = await page
      .waitForFunction(() => {
        const nodes = document.querySelectorAll("button, a, [role='button']");
        for (const node of nodes) {
          const text = (node.textContent ?? "").toLowerCase();
          if (text.includes("continue with google") || text.includes("sign in with google")) {
            return true;
          }
        }
        return Boolean(
          document.querySelector(
            '.cl-socialButtonsBlockButtonGoogle, [data-provider="google"], [data-provider="oauth_google"]',
          ),
        );
      }, { timeout: 15_000 })
      .then(() => findGoogleOAuthControl(page))
      .catch(() => null);
  }

  if (control) {
    console.log("Clicking Continue with Google — complete Google OAuth in the browser.");
    console.log("Approve the Google account prompt if shown. Do not close the window.\n");

    const popupPromise = context.waitForEvent("page", { timeout: 15_000 }).catch(() => null);
    await control.click();

    const popup = await popupPromise;
    if (popup) {
      console.log("Google OAuth popup opened — finish sign-in there.");
      await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
      await Promise.race([
        popup.waitForEvent("close", { timeout: 600_000 }),
        popup.waitForURL(/accounts\.google\.com|google\.com/, { timeout: 30_000 }).then(() =>
          popup.waitForEvent("close", { timeout: 600_000 }),
        ),
      ]).catch(() => undefined);
    } else {
      console.log("OAuth flow opened in the same tab — finish Google sign-in.");
      await page.waitForURL(/accounts\.google\.com|google\.com|clerk\.accounts\.dev/, {
        timeout: 30_000,
      }).catch(() => undefined);
    }
    return true;
  }

  await page.waitForFunction(() => window.Clerk?.loaded, { timeout: 30_000 }).catch(() => undefined);
  return tryClerkProgrammaticGoogle(page);
}

export async function sessionLooksValid(page: Page): Promise<boolean> {
  const url = page.url();
  const overview = await page.request.get("/api/workspace/overview");
  const overviewOk = overview.status() === 200;

  if (overviewOk && url.includes("/dashboard") && !url.includes("/login")) {
    return true;
  }

  if (overviewOk) {
    const dash = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    if (!dash || dash.status() >= 400) return false;
    return !page.url().includes("/login");
  }

  return false;
}

export async function waitForAuthenticatedSession(page: Page): Promise<void> {
  console.log("Waiting for redirect back to /dashboard…");

  try {
    await page.waitForURL(/\/dashboard/, {
      timeout: 600_000,
      waitUntil: "domcontentloaded",
    });
  } catch (err) {
    if (page.isClosed()) {
      throw new Error(
        "Chromium window was closed before OAuth finished. Re-run npm run e2e:auth and keep the browser open.",
      );
    }
    throw err;
  }

  if (page.url().includes("/login")) {
    throw new Error("Returned to /login instead of /dashboard — Google OAuth did not complete.");
  }

  const overview = await page.request.get("/api/workspace/overview");
  if (overview.status() === 307 || overview.status() !== 200) {
    throw new Error(`/api/workspace/overview returned HTTP ${overview.status()} — session not valid.`);
  }
}

export async function runAuthInitFlow(page: Page, context: BrowserContext): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const usedGoogle = await clickGoogleOAuth(page, context);
  if (!usedGoogle) {
    console.log("Continue with Google not found — complete the available login method manually.");
    console.log("(Email/password fallback only when Google OAuth button is absent.)\n");
  }

  await waitForAuthenticatedSession(page);
}

export function logAuthSuccess(authFile: string, cookieNames: string[]): void {
  console.log("\nAuth initialization SUCCESS");
  console.log(`Storage state: ${authFile}`);
  console.log(`Cookie names (values not logged): ${cookieNames.join(", ") || "(none)"}`);
  console.log("/dashboard: OK (no /login redirect)");
  console.log("/api/workspace/overview: HTTP 200\n");
}
