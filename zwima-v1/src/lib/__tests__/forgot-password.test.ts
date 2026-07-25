import { describe, expect, it } from "vitest";
import {
  RESET_SENT_MESSAGE,
  RESET_SUCCESS_MESSAGE,
  clerkErrorMessage,
  isEnumerationSafeClerkError,
  isRateLimitClerkError,
  mapResetSubmitError,
  passwordsMatch,
  validateNewPasswordInput,
} from "@/lib/auth/forgot-password";

describe("forgot-password helpers", () => {
  it("exports stable user-facing copy", () => {
    expect(RESET_SENT_MESSAGE).toContain("重置验证码");
    expect(RESET_SUCCESS_MESSAGE).toContain("密码已重置");
  });

  it("validates password match and length", () => {
    expect(passwordsMatch("abcdefghi", "abcdefghi")).toBe(true);
    expect(passwordsMatch("abcdefghi", "abcdefgHJ")).toBe(false);
    expect(validateNewPasswordInput("short", "short")).toMatch(/at least 8/i);
    expect(validateNewPasswordInput("longenough", "different1")).toMatch(/do not match/i);
    expect(validateNewPasswordInput("longenough", "longenough")).toBeNull();
  });

  it("treats missing identifier as enumeration-safe", () => {
    expect(
      isEnumerationSafeClerkError({
        errors: [{ code: "form_identifier_not_found", message: "Couldn't find your account." }],
      }),
    ).toBe(true);
  });

  it("maps rate limit and bad code without exposing secrets", () => {
    expect(isRateLimitClerkError({ errors: [{ code: "too_many_requests" }] })).toBe(true);
    expect(mapResetSubmitError({ errors: [{ code: "form_code_incorrect", message: "x" }] })).toMatch(
      /Invalid or expired/i,
    );
    expect(clerkErrorMessage({ errors: [{ longMessage: "Clerk says no" }] })).toBe("Clerk says no");
  });
});
