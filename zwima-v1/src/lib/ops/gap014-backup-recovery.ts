/**
 * GAP-014 — Backup & Recovery gate helpers (no network, no Production I/O).
 * Logs must never include secrets, connection strings, or personal data.
 */

export const REQUIRED_ENV_NAMES = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CREDIT_PRICE_ID",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_APP_URL",
  "OPENAI_API_KEY",
  "INTERNAL_SERVICE_ROLE_KEY",
] as const;

/** Names only — scopes are documentation for operators; values never handled here. */
export const ENV_SCOPE_MANIFEST: Record<(typeof REQUIRED_ENV_NAMES)[number], Array<"production" | "preview" | "development">> = {
  DATABASE_URL: ["production", "preview"],
  DIRECT_URL: ["production", "preview"],
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ["production", "preview", "development"],
  CLERK_SECRET_KEY: ["production", "preview", "development"],
  CLERK_WEBHOOK_SECRET: ["production", "preview"],
  STRIPE_SECRET_KEY: ["production", "preview"],
  STRIPE_PUBLISHABLE_KEY: ["production", "preview"],
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ["production", "preview", "development"],
  STRIPE_WEBHOOK_SECRET: ["production", "preview"],
  STRIPE_CREDIT_PRICE_ID: ["production", "preview"],
  RESEND_API_KEY: ["production", "preview"],
  RESEND_FROM_EMAIL: ["production", "preview"],
  NEXT_PUBLIC_APP_URL: ["production", "preview", "development"],
  OPENAI_API_KEY: ["production", "preview"],
  INTERNAL_SERVICE_ROLE_KEY: ["production", "preview"],
};

const SECRET_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "URL_CREDS", re: /(?:postgres|postgresql|mysql|mongodb):\/\/[^\s"'`]+/gi },
  { id: "BEARER", re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi },
  { id: "CLERK_SK", re: /\bsk_(?:test|live)_[A-Za-z0-9]{8,}\b/g },
  { id: "CLERK_PK", re: /\bpk_(?:test|live)_[A-Za-z0-9]{8,}\b/g },
  { id: "STRIPE_SK", re: /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{8,}\b/g },
  { id: "STRIPE_WHSEC", re: /\bwhsec_[A-Za-z0-9]{8,}\b/g },
  { id: "OPENAI", re: /\bsk-[A-Za-z0-9]{16,}\b/g },
  { id: "RESEND", re: /\bre_[A-Za-z0-9]{16,}\b/g },
  { id: "EMAIL", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { id: "JWT", re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
];

export function redactSecrets(text: string): string {
  let out = String(text ?? "");
  for (const { id, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, `[REDACTED_${id}]`);
  }
  return out;
}

export function safeLogLine(line: string): string {
  return redactSecrets(line).replace(/\r?\n/g, " ");
}

export type RecoveryTarget = "preview" | "production" | "local-ci";

export type RecoveryDrillInput = {
  mode?: "dry-run" | "execute";
  target?: RecoveryTarget;
  productionRecoveryAuthorized?: boolean;
  dbMigrationAuthorized?: boolean;
};

export type RecoveryDrillResult = {
  ok: boolean;
  mode: "dry-run" | "execute";
  target: RecoveryTarget;
  status: "PASS" | "FAIL";
  code: string;
  steps: string[];
  productionDatabaseModified: false;
  productionModified: false;
  realPaymentCreated: false;
  realEmailSent: false;
  liveProviderCostIncurred: false;
};

export function runRecoveryDrill(input: RecoveryDrillInput = {}): RecoveryDrillResult {
  const mode = input.mode ?? "dry-run";
  const target = input.target ?? "preview";
  const steps: string[] = [];

  const base = {
    productionDatabaseModified: false as const,
    productionModified: false as const,
    realPaymentCreated: false as const,
    realEmailSent: false as const,
    liveProviderCostIncurred: false as const,
  };

  steps.push(`mode=${mode}`);
  steps.push(`target=${target}`);

  // Production restore is always fail-closed in GAP-014 gate scripts.
  if (target === "production") {
    steps.push("REFUSING production database restore (fail-closed)");
    if (input.productionRecoveryAuthorized) {
      steps.push("PRODUCTION_RECOVERY_AUTHORIZED ignored by gate (no live restore path)");
    }
    return {
      ok: false,
      mode,
      target,
      status: "FAIL",
      code: "PRODUCTION_RECOVERY_FAIL_CLOSED",
      steps,
      ...base,
    };
  }

  if (input.dbMigrationAuthorized) {
    steps.push("REFUSING DB_MIGRATION_AUTHORIZED during recovery drill");
    return {
      ok: false,
      mode,
      target,
      status: "FAIL",
      code: "MIGRATE_FORBIDDEN_IN_DRILL",
      steps,
      ...base,
    };
  }

  if (mode === "execute") {
    steps.push("REFUSING execute mode — GAP-014 drill is dry-run only");
    return {
      ok: false,
      mode,
      target,
      status: "FAIL",
      code: "EXECUTE_FORBIDDEN",
      steps,
      ...base,
    };
  }

  steps.push("verify git recovery point (dry-run)");
  steps.push("verify prisma schema + migrations present (dry-run)");
  steps.push("verify vercel env name manifest (names/scopes only)");
  steps.push("document preview rollback via prior deployment id (no promote)");
  steps.push("skip Supabase physical restore (operator console; not invoked)");
  steps.push("DRY_RUN_COMPLETE");

  return {
    ok: true,
    mode,
    target,
    status: "PASS",
    code: "DRY_RUN_OK",
    steps,
    ...base,
  };
}

export function parseEnvExampleKeys(exampleText: string): string[] {
  const keys: string[] = [];
  for (const line of exampleText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = /^([A-Z0-9_]+)\s*=/.exec(trimmed);
    if (m) keys.push(m[1]);
  }
  return keys;
}

export function assertEnvManifestCoverage(exampleKeys: string[]): {
  ok: boolean;
  missingFromManifest: string[];
  missingFromExample: string[];
} {
  const exampleSet = new Set(exampleKeys);
  const manifestSet = new Set<string>(REQUIRED_ENV_NAMES);
  // DIRECT_URL may be absent from .env.example but required for migrate — still in manifest
  const missingFromExample = REQUIRED_ENV_NAMES.filter(
    (k) => k !== "DIRECT_URL" && !exampleSet.has(k),
  );
  const criticalExample = exampleKeys.filter((k) =>
    /SECRET|API_KEY|DATABASE_URL|WEBHOOK|PASSWORD|TOKEN/i.test(k),
  );
  const missingFromManifest = criticalExample.filter((k) => !manifestSet.has(k) && k !== "SERVICE_ROLE_API_KEY");
  return {
    ok: missingFromExample.length === 0,
    missingFromManifest,
    missingFromExample,
  };
}

export function looksLikeProdDbHost(host: string): boolean {
  const h = String(host || "").toLowerCase();
  return /prod(uction)?/i.test(h) || h.includes("zwima-group.info");
}

/** Redact host for logs — never print full connection string. */
export function summarizeDbHost(rawUrl: string | undefined | null): {
  present: boolean;
  hostPrefix: string;
  looksProd: boolean;
} {
  if (!rawUrl || !String(rawUrl).trim()) {
    return { present: false, hostPrefix: "(absent)", looksProd: false };
  }
  try {
    const normalized = String(rawUrl).replace(/^postgres(ql)?:\/\//i, "http://");
    const u = new URL(normalized);
    const host = u.hostname || "invalid";
    const looksProd =
      /prod(uction)?/i.test(host) ||
      host.includes("zwima-group.info") ||
      /prod(uction)?/i.test(u.pathname);
    return {
      present: true,
      hostPrefix: host.slice(0, 8) + (host.length > 8 ? "…" : ""),
      looksProd,
    };
  } catch {
    return { present: true, hostPrefix: "(unparseable)", looksProd: true };
  }
}
