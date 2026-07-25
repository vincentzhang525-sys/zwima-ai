/** Shared public-route patterns for middleware gap tests (mirrors middleware.ts). */
const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/sso-callback",
  "/cookies",
  "/imprint",
  "/impressum",
  "/privacy",
  "/terms",
  "/legal",
  "/api/webhooks",
  "/api/health",
  "/api/internal",
  "/api/v1",
  "/api/workspace",
  "/__clerk",
];

export function isPublicRouteMatchers(pathname: string): boolean {
  const p = pathname.split("?")[0] || "/";
  if (p === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => {
    if (prefix === "/") return false;
    return p === prefix || p.startsWith(prefix + "/") || p.startsWith(prefix);
  });
}
