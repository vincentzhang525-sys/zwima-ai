import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export async function sendVerificationEmail(params: {
  to: string;
  companyName?: string;
  verifyUrl: string;
}) {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || "hello@zwima-group.info";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h1 style="color:#0f172a;">Welcome to ZWIMA AI</h1>
      <p>Thank you for registering${params.companyName ? ` with <strong>${params.companyName}</strong>` : ""}.</p>
      <p>Please verify your email to activate your account:</p>
      <p><a href="${params.verifyUrl}" style="background:#1e3a8a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Verify Email</a></p>
      <p style="color:#64748b;font-size:14px;">ZWIMA AI — AI API Platform for Europe</p>
    </div>
  `;

  if (!resend) {
    console.log("[resend:mock] verification email to", params.to);
    return { ok: true, mock: true };
  }

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: "Verify your ZWIMA AI account",
    html,
  });

  if (error) throw new Error(error.message);
  return { ok: true };
}
