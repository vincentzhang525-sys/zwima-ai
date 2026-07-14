import { NextResponse } from "next/server";

function analyzeConnectionString(raw: string | undefined) {
  const value = raw ?? "";
  const first = value.charAt(0);
  const last = value.charAt(value.length - 1);

  let urlParseOk = false;
  let urlParseError: string | null = null;
  if (value) {
    try {
      const normalized = value.replace(/^postgres(ql)?:\/\//i, "http://");
      new URL(normalized);
      urlParseOk = /^postgres(ql)?:\/\//i.test(value);
      if (!urlParseOk) urlParseError = "missing postgresql:// or postgres:// prefix";
    } catch (err) {
      urlParseError = err instanceof Error ? err.message : "URL parse failed";
    }
  } else {
    urlParseError = "DATABASE_URL empty";
  }

  let prismaOk = false;
  let prismaError: string | null = null;
  if (value && urlParseOk) {
    prismaOk = true;
  } else if (!value) {
    prismaError = "DATABASE_URL empty";
  } else {
    prismaError = urlParseError ?? "invalid for Prisma";
  }

  return {
    length: value.length,
    firstCharacter: first || null,
    firstCharacterCode: first ? first.charCodeAt(0) : null,
    lastCharacter: last || null,
    lastCharacterCode: last ? last.charCodeAt(0) : null,
    containsDoubleQuote: value.includes('"'),
    containsNewline: /[\r\n]/.test(value),
    containsSpace: /\s/.test(value),
    urlParseOk,
    urlParseError,
    prismaConnectionStringOk: prismaOk,
    prismaError,
  };
}

/** Preview-only runtime DATABASE_URL shape check — never returns secret material. */
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Preview diagnostics only" }, { status: 404 });
  }

  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    routingEngine: process.env.ROUTING_ENGINE ?? "legacy",
    stripePreviewDisabled: process.env.STRIPE_PREVIEW_DISABLED === "true",
    clerkConfigured:
      (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_") &&
      (process.env.CLERK_SECRET_KEY ?? "").startsWith("sk_") &&
      !(process.env.CLERK_SECRET_KEY ?? "").includes("placeholder"),
    databaseUrl: analyzeConnectionString(process.env.DATABASE_URL),
    directUrl: analyzeConnectionString(process.env.DIRECT_URL),
  });
}
