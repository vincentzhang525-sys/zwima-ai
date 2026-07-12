const crypto = require("crypto");

const CODE_TTL_MINUTES = {
  email_verify: 30,
  password_reset: 60,
};

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

async function storeCode(admin, { userId, email, purpose }) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + (CODE_TTL_MINUTES[purpose] || 30) * 60 * 1000).toISOString();

  await admin.from("auth_codes").update({ used_at: new Date().toISOString() }).eq("email", email).eq("purpose", purpose).is("used_at", null);

  const { error } = await admin.from("auth_codes").insert({
    user_id: userId || null,
    email,
    code_hash: hashCode(code),
    purpose,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { code, expiresAt };
}

async function verifyCode(admin, { email, code, purpose }) {
  const normalized = String(email || "").trim().toLowerCase();
  const { data: row, error } = await admin
    .from("auth_codes")
    .select("*")
    .eq("email", normalized)
    .eq("purpose", purpose)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false, error: "Invalid or expired verification code." };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "Verification code has expired." };
  if (row.code_hash !== hashCode(code)) return { ok: false, error: "Invalid verification code." };

  await admin.from("auth_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true, userId: row.user_id, row };
}

module.exports = {
  generateCode,
  hashCode,
  storeCode,
  verifyCode,
  CODE_TTL_MINUTES,
};
