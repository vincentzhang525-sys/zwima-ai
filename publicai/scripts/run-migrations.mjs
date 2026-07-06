#!/usr/bin/env node
/**
 * Trigger production migrate + verify. No local secrets required.
 */
const baseUrl = (process.argv[2] || "https://zwima-ai.vercel.app").replace(/\/$/, "");

async function main() {
  console.log(`POST ${baseUrl}/api/db/migrate`);
  const res = await fetch(`${baseUrl}/api/db/migrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    console.error(text.slice(0, 500));
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
