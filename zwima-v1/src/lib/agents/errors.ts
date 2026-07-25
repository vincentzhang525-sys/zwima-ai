export class AgentServiceError extends Error {
  code: string;
  status: number;
  details?: unknown;
  retryable: boolean;

  constructor(code: string, message: string, status: number, details?: unknown, retryable = false) {
    super(message);
    this.name = "AgentServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = retryable;
  }
}

export function sanitizeAgentMessage(err: unknown): string {
  if (err instanceof AgentServiceError) return err.message;
  if (err instanceof Error) {
    const msg = err.message;
    if (/prisma|postgresql|ECONNREFUSED|P1001|database|stack/i.test(msg)) {
      return "An internal error occurred";
    }
    if (/api[_-]?key|secret|authorization|bearer|password|smtp/i.test(msg)) {
      return "An internal error occurred";
    }
    return msg.length > 200 ? "Request failed" : msg;
  }
  return "Request failed";
}

export function mapAgentError(err: unknown): {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  details?: unknown;
} {
  if (err instanceof AgentServiceError) {
    return {
      code: err.code,
      message: sanitizeAgentMessage(err),
      status: err.status,
      retryable: err.retryable,
      details: err.details,
    };
  }
  if (err && typeof err === "object" && "code" in err && "status" in err) {
    const apiErr = err as { code: string; message?: string; status: number };
    if (typeof apiErr.status === "number" && typeof apiErr.code === "string") {
      return {
        code: apiErr.code,
        message: sanitizeAgentMessage(err),
        status: apiErr.status,
        retryable: false,
      };
    }
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("unauthorized") || msg.includes("authentication")) {
      return { code: "UNAUTHORIZED", message: "Authentication required", status: 401, retryable: false };
    }
    if (msg.includes("forbidden")) {
      return { code: "FORBIDDEN", message: "Forbidden", status: 403, retryable: false };
    }
  }
  return {
    code: "INTERNAL_ERROR",
    message: sanitizeAgentMessage(err),
    status: 500,
    retryable: true,
  };
}
