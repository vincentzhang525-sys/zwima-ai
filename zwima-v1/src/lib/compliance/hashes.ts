import { createHash } from "crypto";

/**
 * Stable sha256 hashing helper for the runtime compliance center.
 *
 * Never pass plaintext prompt/response content anywhere except through this
 * function — the compliance data model only ever stores the resulting hash.
 * An optional pepper (COMPLIANCE_HASH_PEPPER) can be set to make stored
 * hashes non-reversible via public rainbow tables without changing the
 * public API shape.
 */
export function getHashPepper(): string {
  return process.env.COMPLIANCE_HASH_PEPPER || "";
}

export function hashText(text: string, pepper: string = getHashPepper()): string {
  return createHash("sha256").update(`${pepper}:${text}`, "utf8").digest("hex");
}

export function hashTextOrNull(text: string | null | undefined): string | null {
  if (text == null || text === "") return null;
  return hashText(text);
}

/** Stable hash over an arbitrary object (keys sorted) for fingerprinting/idempotency. */
export function hashObject(obj: Record<string, unknown>): string {
  const sorted = JSON.stringify(sortKeysDeep(obj));
  return hashText(sorted, getHashPepper());
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return entries.reduce<Record<string, unknown>>((acc, [k, v]) => {
      acc[k] = sortKeysDeep(v);
      return acc;
    }, {});
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}
