import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "phase1-incremental.sql");
const dest = path.join(root, "prisma/migrations/20250713180000_phase1_infra/migration.sql");

let sql = fs.readFileSync(src, "utf8");
sql = sql.replace(
  'ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;',
  `ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "Provider" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Provider" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Provider" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill ApiKey status from enabled flag
UPDATE "ApiKey" SET "status" = 'DISABLED' WHERE "enabled" = false;`
);

const header = `-- Phase 1 incremental migration (Production baseline -> Phase 1 schema)
-- Safe: additive ALTER + new tables only. No DROP of existing billing tables.

`;

fs.writeFileSync(dest, header + sql);
console.log("Wrote", dest, "lines:", (header + sql).split("\n").length);
