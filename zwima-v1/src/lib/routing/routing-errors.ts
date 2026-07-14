import { ApiError } from "../api-errors";
import type { RoutingNoEligibleErrorDetail } from "./routing-types";

export class RoutingError extends ApiError {
  constructor(message: string, requestId?: string) {
    super("ROUTING_FAILED", message, 503, requestId);
  }
}

export class RoutingNoEligibleError extends ApiError {
  detail: RoutingNoEligibleErrorDetail;

  constructor(detail: RoutingNoEligibleErrorDetail, requestId?: string) {
    super("ROUTING_FAILED", `No eligible provider for ${detail.requestedCapability} request`, 503, requestId);
    this.detail = detail;
  }

  toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      error: {
        ...base.error,
        code: "ROUTING_NO_ELIGIBLE_PROVIDER" as typeof base.error.code,
        routing: this.detail,
      },
    };
  }
}

export class MarginProtectionError extends ApiError {
  constructor(message: string, requestId?: string) {
    super("MARGIN_PROTECTION", message, 402, requestId);
  }
}
