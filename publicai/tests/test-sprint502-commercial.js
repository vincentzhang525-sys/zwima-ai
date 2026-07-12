const test = require("node:test");
const assert = require("node:assert/strict");
const { hashCode, generateCode } = require("../api/lib/auth/codes");
const { allowsMockPaymentFallback, isCommercialBetaMode } = require("../api/lib/commercial/environment");

test("auth codes hash deterministically", () => {
  assert.equal(hashCode("123456"), hashCode("123456"));
  assert.notEqual(hashCode("123456"), hashCode("654321"));
});

test("generateCode returns 6 digits", () => {
  const code = generateCode();
  assert.match(code, /^\d{6}$/);
});

test("mock payment fallback disabled outside local", () => {
  const prev = process.env.VERCEL;
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.STRIPE_MODE = "mock";
  delete require.cache[require.resolve("../api/lib/commercial/environment")];
  const env = require("../api/lib/commercial/environment");
  assert.equal(env.allowsMockPaymentFallback(), false);
  process.env.VERCEL = prev;
});
