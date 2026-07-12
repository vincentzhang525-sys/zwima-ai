const crypto = require("crypto");

function encodeForm(data) {
  return Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function stripeRequest(path, method, formData, secretKey) {
  const secret = secretKey || process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    const err = new Error("Missing Stripe secret key");
    err.code = "STRIPE_MISCONFIGURED";
    throw err;
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: method || "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData ? encodeForm(formData) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Stripe error ${res.status}`);
    err.code = json?.error?.code || "STRIPE_API_ERROR";
    err.status = res.status;
    throw err;
  }
  return json;
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const parts = String(signatureHeader)
    .split(",")
    .reduce((acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

module.exports = { stripeRequest, verifyWebhookSignature, encodeForm };
