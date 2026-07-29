#!/usr/bin/env npx tsx
/**
 * GAP-011 Production read-only physical state audit.
 * SELECT-only. Never prints connection strings, passwords, or secrets.
 *
 * Manual operator tool only:
 * - Not imported by Next.js app code
 * - Excluded from tsconfig typecheck / Next production bundle
 * - Must NOT run during Vercel build
 * - Must NOT be pointed at Production unless operator sets DIRECT_URL in a local shell
 *
 * Run in a shell where DIRECT_URL (or DATABASE_URL) is already set:
 *   npx tsx scripts/gap011-production-readonly-audit.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const GAP011_MIGRATION = "20260728220000_gap011_legal_consent";
const EXACT_TABLES = [
  "LegalConsentAcceptance",
  "legal_consent_acceptance",
  "AccountDeletionRequest",
  "account_deletion_request",
] as const;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "prisma/schema.prisma");
const migrationPath = path.join(
  root,
  `prisma/migrations/${GAP011_MIGRATION}/migration.sql`,
);

type Row = Record<string, unknown>;

function fail(message: string): never {
  console.error(`AUDIT_ERROR=${message}`);
  process.exit(1);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printRows(label: string, rows: Row[]) {
  console.log(`${label}_COUNT=${rows.length}`);
  if (rows.length === 0) {
    console.log(`${label}=NONE`);
    return;
  }
  for (const row of rows) {
    console.log(`${label}=${JSON.stringify(row)}`);
  }
}

function extractModelBlock(modelName: string, schema: string): string | null {
  const re = new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = schema.match(re);
  return match?.[1] ?? null;
}

function extractMap(modelName: string, schema: string): string | null {
  const block = extractModelBlock(modelName, schema);
  if (!block) return null;
  const mapMatch = block.match(/@@map\("([^"]+)"\)/);
  return mapMatch?.[1] ?? null;
}

function extractCreateTableNames(sql: string): string[] {
  const names: string[] = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function summarizeMigrationRecord(rows: Row[]) {
  if (rows.length === 0) {
    return {
      found: false,
      status: "NOT_FOUND",
    };
  }
  const row = rows[0];
  const rolledBackAt = row.rolled_back_at;
  const finishedAt = row.finished_at;
  let status = "UNKNOWN";
  if (rolledBackAt != null) status = "ROLLED_BACK";
  else if (finishedAt != null) status = "APPLIED";
  else status = "INCOMPLETE";
  return { found: true, status, row };
}

function tableNamesFromPgTables(rows: Row[]): string[] {
  return rows
    .map((r: Row) => String(r.tablename ?? ""))
    .filter(Boolean)
    .sort();
}

function assessPhysicalSchemaMatch(params: {
  prismaLegalMap: string;
  prismaAccountMap: string;
  migrationTables: string[];
  pgTablesFound: string[];
}): { match: string; p1014Cause: string } {
  const { prismaLegalMap, prismaAccountMap, migrationTables, pgTablesFound } =
    params;

  const legalExists = pgTablesFound.includes(prismaLegalMap);
  const accountExists = pgTablesFound.includes(prismaAccountMap);
  const migrationLegal = migrationTables.includes(prismaLegalMap);
  const migrationAccount = migrationTables.includes(prismaAccountMap);

  let match: string;
  if (legalExists && accountExists && migrationLegal && migrationAccount) {
    match = "YES";
  } else if (!legalExists && !accountExists) {
    match = "NO_TABLES_MISSING";
  } else {
    match = "PARTIAL_OR_MISMATCH";
  }

  const p1014Cause =
    "POST_APPLY_VERIFY used unquoted regclass 'public.LegalConsentAcceptance' " +
    "which PostgreSQL folds to lowercase legalconsentacceptance; " +
    "migration creates quoted PascalCase tables. " +
    "P1014 during prisma db execute verify is not proof of missing tables — " +
    "confirm with pg_tables using exact tablename.";

  return { match, p1014Cause };
}

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    fail("DIRECT_URL or DATABASE_URL must be set in this shell session");
  }
  if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
    fail("Connection env must use postgres:// or postgresql:// scheme");
  }

  if (!fs.existsSync(schemaPath)) fail("Missing prisma/schema.prisma");
  if (!fs.existsSync(migrationPath)) fail(`Missing ${GAP011_MIGRATION}/migration.sql`);

  const schema = fs.readFileSync(schemaPath, "utf8");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  const prismaLegalMap = extractMap("LegalConsentAcceptance", schema) ?? "LegalConsentAcceptance";
  const prismaAccountMap =
    extractMap("AccountDeletionRequest", schema) ?? "AccountDeletionRequest";
  const migrationTables = extractCreateTableNames(migrationSql);

  section("SCHEMA_FILE_COMPARISON");
  console.log(`PRISMA_LEGAL_CONSENT_@@MAP=${extractMap("LegalConsentAcceptance", schema) ?? "NONE_DEFAULT_MODEL_NAME"}`);
  console.log(`PRISMA_ACCOUNT_DELETION_@@MAP=${extractMap("AccountDeletionRequest", schema) ?? "NONE_DEFAULT_MODEL_NAME"}`);
  console.log(`MIGRATION_SQL_CREATE_TABLES=${JSON.stringify(migrationTables)}`);

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    console.log("PRODUCTION_CONNECTION_STATUS=OK");

    section("A_PG_TABLES_EXACT_AND_PATTERN");
    const exactPg = await client.query<Row>(
      `SELECT schemaname, tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])
       ORDER BY tablename`,
      [EXACT_TABLES as unknown as string[]],
    );
    printRows("A_EXACT_PG_TABLE", exactPg.rows);

    const patternPg = await client.query<Row>(
      `SELECT schemaname, tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND (
           tablename ILIKE '%legal%'
           OR tablename ILIKE '%consent%'
           OR tablename ILIKE '%deletion%'
           OR tablename ILIKE '%account%'
         )
       ORDER BY tablename`,
    );
    printRows("A_PATTERN_PG_TABLE", patternPg.rows);

    section("B_INFORMATION_SCHEMA_TABLES");
    const infoTables = await client.query<Row>(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND (
           table_name = ANY($1::text[])
           OR table_name ILIKE '%legal%'
           OR table_name ILIKE '%consent%'
           OR table_name ILIKE '%deletion%'
           OR table_name ILIKE '%account%'
         )
       ORDER BY table_name`,
      [EXACT_TABLES as unknown as string[]],
    );
    printRows("B_INFO_TABLE", infoTables.rows);

    const relatedNames = infoTables.rows
      .map((r: Row) => String(r.table_name ?? ""))
      .filter(Boolean);

    section("C_INFORMATION_SCHEMA_COLUMNS");
    if (relatedNames.length === 0) {
      console.log("C_INFO_COLUMN_COUNT=0");
      console.log("C_INFO_COLUMN=NONE");
    } else {
      const infoColumns = await client.query<Row>(
        `SELECT table_schema, table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])
         ORDER BY table_name, ordinal_position`,
        [relatedNames],
      );
      printRows("C_INFO_COLUMN", infoColumns.rows);
    }

    section("D_PRISMA_MIGRATIONS_GAP011");
    const migrationRecord = await client.query<Row>(
      `SELECT id, migration_name, started_at, finished_at, rolled_back_at,
              applied_steps_count, logs
       FROM "_prisma_migrations"
       WHERE migration_name = $1
       ORDER BY started_at DESC`,
      [GAP011_MIGRATION],
    );
    printRows("D_GAP011_MIGRATION", migrationRecord.rows);

    section("E_PG_CLASS_CASE_CHECK");
    const pgClass = await client.query<Row>(
      `SELECT n.nspname AS schema, c.relname AS relname, c.relkind
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND c.relname = ANY($1::text[])
       ORDER BY c.relname`,
      [
        [
          "LegalConsentAcceptance",
          "AccountDeletionRequest",
          "legalconsentacceptance",
          "accountdeletionrequest",
          "legal_consent_acceptance",
          "account_deletion_request",
        ],
      ],
    );
    printRows("E_PG_CLASS", pgClass.rows);

    const pgTablesFound = tableNamesFromPgTables([
      ...exactPg.rows,
      ...patternPg.rows,
    ]);
    const uniquePgTables = [...new Set(pgTablesFound)];

    const legalTables = uniquePgTables.filter(
      (t) =>
        t === "LegalConsentAcceptance" ||
        t === "legal_consent_acceptance" ||
        t.toLowerCase().includes("legal") ||
        t.toLowerCase().includes("consent"),
    );
    const accountDeletionTables = uniquePgTables.filter(
      (t) =>
        t === "AccountDeletionRequest" ||
        t === "account_deletion_request" ||
        t.toLowerCase().includes("deletion"),
    );

    const migrationSummary = summarizeMigrationRecord(migrationRecord.rows);
    const { match, p1014Cause } = assessPhysicalSchemaMatch({
      prismaLegalMap,
      prismaAccountMap,
      migrationTables,
      pgTablesFound: uniquePgTables,
    });

    let safeNextAction = "UNKNOWN";
    if (match === "YES") {
      safeNextAction =
        "NO_DB_REPAIR_NEEDED; verify authenticated /dashboard in browser; fix audit script regclass quoting only";
    } else if (migrationSummary.found && migrationSummary.status === "APPLIED" && match === "NO_TABLES_MISSING") {
      safeNextAction =
        "WAIT AUTHORIZE_GAP011_RECORD_ROLLBACK_AND_REAPPLY: single rolled-back resolve, re-run migration.sql, pg_tables verify, single applied resolve";
    } else if (!migrationSummary.found && match === "NO_TABLES_MISSING") {
      safeNextAction =
        "WAIT AUTHORIZE_GAP011_SQL_ONLY_APPLY: execute migration.sql only (no batch deploy); then single applied resolve after pg_tables verify";
    } else {
      safeNextAction =
        "REVIEW PARTIAL_OR_MISMATCH output above before any Production write authorization";
    }

    section("FINAL_READONLY_AUDIT_SUMMARY");
    console.log(`PRODUCTION_CONNECTION_STATUS=OK`);
    console.log(`GAP011_MIGRATION_RECORD_FOUND=${migrationSummary.found ? "YES" : "NO"}`);
    console.log(`GAP011_MIGRATION_RECORD_STATUS=${migrationSummary.status}`);
    console.log(`LEGAL_CONSENT_TABLES_FOUND=${legalTables.length ? JSON.stringify(legalTables) : "NONE"}`);
    console.log(`ACCOUNT_DELETION_TABLES_FOUND=${accountDeletionTables.length ? JSON.stringify(accountDeletionTables) : "NONE"}`);
    console.log(`PRISMA_LEGAL_CONSENT_MAPPING=${prismaLegalMap}`);
    console.log(`PRISMA_ACCOUNT_DELETION_MAPPING=${prismaAccountMap}`);
    console.log(`MIGRATION_SQL_PHYSICAL_TABLE_NAMES=${JSON.stringify(migrationTables)}`);
    console.log(`PHYSICAL_SCHEMA_MATCH=${match}`);
    console.log(`P1014_ROOT_CAUSE=${p1014Cause}`);
    console.log(`PRODUCTION_DATABASE_MODIFIED=NO`);
    console.log(`SAFE_NEXT_ACTION=${safeNextAction}`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
});
