#!/usr/bin/env node
/**
 * GAP-001 Closed Beta smoke — tiny non-streaming OpenAI chat via /api/v1/chat.
 *
 * Requires (never printed):
 *   CLOSED_BETA_SMOKE_AUTHORIZED=true
 *   SMOKE_BASE_URL=https://...
 *   SMOKE_TEST_API_KEY=...
 *
 * Optional:
 *   SMOKE_MODEL=gpt-5-nano
 */
const authorized = process.env.CLOSED_BETA_SMOKE_AUTHORIZED === "true";
const baseUrl = (process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
const apiKey = process.env.SMOKE_TEST_API_KEY || "";
const model = process.env.SMOKE_MODEL || "gpt-5-nano";

function redact(s) {
  return String(s).replace(/sk_[a-zA-Z0-9_-]+/g, "[REDACTED_KEY]");
}

async function main() {
  if (!authorized) {
    console.log(JSON.stringify({ ok: false, skipped: true, reason: "CLOSED_BETA_SMOKE_AUTHORIZED!=true" }));
    process.exit(0);
  }
  if (!baseUrl || !apiKey) {
    console.log(JSON.stringify({ ok: false, error: "SMOKE_BASE_URL and SMOKE_TEST_API_KEY required" }));
    process.exit(1);
  }

  const res = await fetch(`${baseUrl}/api/v1/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-request-id": `gap001-smoke-${Date.now()}`,
    },
    body: JSON.stringify({
      model,
      provider: "openai",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      maxTokens: 8,
      temperature: 0,
    }),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }

  const report = {
    ok: res.status === 200 && Boolean(body?.content || body?.usage),
    status: res.status,
    provider: body?.provider ?? null,
    model: body?.model ?? null,
    hasContent: Boolean(body?.content),
    usageLogId: body?.usage?.usageLogId ?? null,
    inputTokens: body?.usage?.inputTokens ?? null,
    outputTokens: body?.usage?.outputTokens ?? null,
    costCredits: body?.usage?.costCredits ?? null,
    errorCode: body?.error?.code ?? null,
    errorMessage: body?.error?.message ? redact(String(body.error.message)).slice(0, 300) : null,
  };

  console.log(redact(JSON.stringify(report, null, 2)));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: redact(err instanceof Error ? err.message : String(err)) }));
  process.exit(1);
});
