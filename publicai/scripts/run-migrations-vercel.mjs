#!/usr/bin/env node
/**
 * Fetch Vercel production secrets and run migrations + seed locally.
 */
await import("./fetch-vercel-env.mjs");
await import("./run-migrations-local.mjs");
