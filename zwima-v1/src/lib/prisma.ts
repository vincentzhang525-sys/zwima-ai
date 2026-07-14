import { PrismaClient } from "@prisma/client";
import { applyResolvedDatabaseUrl, resolvePrismaRuntimeDatabaseUrl } from "./database-url";

applyResolvedDatabaseUrl("transaction");

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const runtimeDatabaseUrl = resolvePrismaRuntimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: runtimeDatabaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
