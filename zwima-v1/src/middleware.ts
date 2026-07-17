import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/api/v1(.*)",
  "/api/workspace(.*)",
]);

function clerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const sk = process.env.CLERK_SECRET_KEY ?? "";
  return pk.startsWith("pk_") && sk.startsWith("sk_") && !sk.includes("placeholder") && !pk.includes("placeholder");
}

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect({ unauthenticatedUrl: "/login" });
  }
});

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
  ],
};
