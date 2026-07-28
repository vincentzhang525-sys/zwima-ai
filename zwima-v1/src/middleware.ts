import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { classifyClerkInstance, isClerkInstanceIsolated } from "@/lib/auth/clerk-instance-gate";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/forgot-password(.*)",
  "/sso-callback(.*)",
  "/cookies(.*)",
  "/imprint(.*)",
  "/impressum(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/legal(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",
  "/api/internal(.*)",
  "/api/v1(.*)",
  "/api/workspace(.*)",
  "/__clerk(.*)",
]);

/** Auth entry pages — signed-in users must not stay here. */
const isAuthEntryRoute = createRouteMatcher(["/login(.*)", "/signup(.*)", "/forgot-password(.*)"]);

function clerkConfigured(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV ?? "").toLowerCase();
  // On Vercel production/preview, refuse mismatched Clerk instances (GAP-003).
  if ((vercelEnv === "production" || vercelEnv === "preview") && !isClerkInstanceIsolated()) {
    return false;
  }
  const { configured, instanceType } = classifyClerkInstance();
  return configured && instanceType !== "placeholder" && instanceType !== "mismatch";
}

/**
 * Production publishable key encodes FAPI host clerk.zwima-group.info.
 * Preview / Development (pk_test): never enable the Frontend API proxy.
 */
function shouldEnableFrontendApiProxy(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
  if (vercelEnv === "preview" || vercelEnv === "development") return false;

  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  if (pk.startsWith("pk_test_")) return false;

  return Boolean(process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim()) || pk.startsWith("pk_live_");
}

const withClerk = clerkMiddleware(
  async (auth, req) => {
    const session = await auth();

    if (session.userId && isAuthEntryRoute(req)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (!isPublicRoute(req)) {
      const signInUrl = new URL("/login", req.url).toString();
      await auth.protect({ unauthenticatedUrl: signInUrl });
    }
  },
  {
    frontendApiProxy: {
      enabled: shouldEnableFrontendApiProxy(),
    },
  },
);

function withoutClerk(req: NextRequest) {
  if (!isPublicRoute(req)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export default clerkConfigured() ? withClerk : withoutClerk;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
