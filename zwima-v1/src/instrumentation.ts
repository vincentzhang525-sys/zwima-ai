/**
 * Next.js instrumentation — fail-closed env gates at runtime start (GAP-003).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { validateEnvAtStartup } = await import("@/lib/env");
  validateEnvAtStartup();
}
