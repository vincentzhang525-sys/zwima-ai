#!/usr/bin/env node
/** Print DATABASE_URL metadata from current process.env — no secrets. */
const raw = process.env.DATABASE_URL ?? "";
const first = raw.charAt(0);
const last = raw.charAt(raw.length - 1);
let urlParseOk = false;
let urlParseError = null;
if (raw) {
  try {
    const normalized = raw.replace(/^postgres(ql)?:\/\//i, "http://");
    new URL(normalized);
    urlParseOk = /^postgres(ql)?:\/\//i.test(raw);
    if (!urlParseOk) urlParseError = "missing postgresql:// or postgres:// prefix";
  } catch (err) {
    urlParseError = err instanceof Error ? err.message : "URL parse failed";
  }
} else {
  urlParseError = "DATABASE_URL empty";
}

console.log(
  JSON.stringify(
    {
      source: process.env.VERCEL ? "vercel_injected_process_env" : "local_process_env",
      vercelEnv: process.env.VERCEL_ENV ?? null,
      length: raw.length,
      firstCharacter: first || null,
      firstCharacterCode: first ? first.charCodeAt(0) : null,
      lastCharacter: last || null,
      lastCharacterCode: last ? last.charCodeAt(0) : null,
      containsDoubleQuote: raw.includes('"'),
      containsNewline: /[\r\n]/.test(raw),
      containsSpace: /\s/.test(raw),
      urlParseOk,
      urlParseError,
      prismaConnectionStringOk: Boolean(raw && urlParseOk),
      prismaError: !raw ? "DATABASE_URL empty" : urlParseOk ? null : urlParseError,
    },
    null,
    2,
  ),
);
