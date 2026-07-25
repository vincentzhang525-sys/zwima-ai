/** Client-safe helpers for forgot-password UI (no secrets, no Clerk tokens). */

export const RESET_SENT_MESSAGE =
  "如果该邮箱已注册，我们已发送重置验证码。";

export const RESET_SUCCESS_MESSAGE = "密码已重置，请使用新密码登录。";

const ENUMERATION_SAFE_CODES = new Set([
  "form_identifier_not_found",
  "form_param_nil",
  "resource_not_found",
]);

const RATE_LIMIT_CODES = new Set([
  "too_many_requests",
  "rate_limit_exceeded",
  "verification_failed_too_many_times",
]);

type ClerkLikeError = {
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  message?: string;
};

export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}

export function validateNewPasswordInput(password: string, confirm: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!passwordsMatch(password, confirm)) {
    return "Passwords do not match.";
  }
  return null;
}

export function isEnumerationSafeClerkError(err: unknown): boolean {
  const code = clerkErrorCode(err);
  if (code && ENUMERATION_SAFE_CODES.has(code)) return true;
  const msg = clerkErrorMessage(err).toLowerCase();
  return msg.includes("couldn't find") || msg.includes("not found") || msg.includes("couldn't find your account");
}

export function isRateLimitClerkError(err: unknown): boolean {
  const code = clerkErrorCode(err);
  if (code && RATE_LIMIT_CODES.has(code)) return true;
  const msg = clerkErrorMessage(err).toLowerCase();
  return msg.includes("too many") || msg.includes("rate limit") || msg.includes("try again");
}

export function clerkErrorCode(err: unknown): string | undefined {
  const e = err as ClerkLikeError;
  return e?.errors?.[0]?.code;
}

/** Safe user-facing message — never includes verification codes or passwords. */
export function clerkErrorMessage(err: unknown): string {
  const e = err as ClerkLikeError;
  const fromClerk = e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message;
  if (typeof fromClerk === "string" && fromClerk.trim()) return fromClerk.trim();
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export function mapResetSubmitError(err: unknown): string {
  if (isRateLimitClerkError(err)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  const code = clerkErrorCode(err);
  if (code === "form_code_incorrect" || code === "verification_failed") {
    return "Invalid or expired verification code.";
  }
  if (code === "form_password_pwned" || code === "form_password_not_strong_enough") {
    return clerkErrorMessage(err);
  }
  if (code === "form_password_validation_failed") {
    return clerkErrorMessage(err);
  }
  return clerkErrorMessage(err);
}
