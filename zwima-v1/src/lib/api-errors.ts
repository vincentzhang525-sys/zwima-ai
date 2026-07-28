import { sanitizeForLog } from "@/lib/logging/sanitize";

export type ApiErrorCode =
  | "INVALID_API_KEY"
  | "API_KEY_EXPIRED"
  | "API_KEY_REVOKED"
  | "API_KEY_DISABLED"
  | "API_KEY_PERMISSION_DENIED"
  | "API_KEY_PROVIDER_NOT_ALLOWED"
  | "API_KEY_MODEL_NOT_ALLOWED"
  | "API_KEY_RATE_LIMITED"
  | "API_KEY_BUDGET_EXCEEDED"
  | "INSUFFICIENT_CREDITS"
  | "MODEL_NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "ROUTING_FAILED"
  | "MARGIN_PROTECTION"
  | "BUDGET_EXCEEDED"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TERMS_NOT_ACCEPTED"
  | "BILLING_PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  requestId?: string;

  constructor(code: ApiErrorCode, message: string, status: number, requestId?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId: this.requestId,
      },
    };
  }
}

export function errorResponse(err: ApiError | Error, requestId?: string) {
  if (err instanceof ApiError) {
    return Response.json(err.toJSON(), { status: err.status });
  }
  const raw = err instanceof Error ? err.message : "Request failed";
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: sanitizeForLog(raw),
        requestId,
      },
    },
    { status: 500 }
  );
}
