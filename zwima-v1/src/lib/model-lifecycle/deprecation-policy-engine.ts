/**
 * GAP-010 — Deprecation policy engine (pure evaluation, no email/Provider I/O).
 */

export type DeprecationPolicySnapshot = {
  id: string;
  status:
    | "ACTIVE"
    | "DEPRECATION_ANNOUNCED"
    | "DEPRECATED"
    | "SUNSET_SCHEDULED"
    | "RETIRED"
    | "DISABLED";
  announcementDate?: Date | null;
  deprecationDate?: Date | null;
  sunsetDate?: Date | null;
  disabledAt?: Date | null;
  replacementModelCode?: string | null;
  customerMessage?: string | null;
  archived?: boolean;
};

export type DeprecationEvaluation = {
  policyId: string | null;
  routable: boolean;
  excludeReason: string | null;
  replacementModelCode: string | null;
  customerMessage: string | null;
  /** Soft warning — still routable until sunset/disable */
  announced: boolean;
};

export function evaluateDeprecationPolicy(
  policy: DeprecationPolicySnapshot | null | undefined,
  now: Date = new Date(),
): DeprecationEvaluation {
  if (!policy || policy.archived) {
    return {
      policyId: null,
      routable: true,
      excludeReason: null,
      replacementModelCode: null,
      customerMessage: null,
      announced: false,
    };
  }

  const replacement = policy.replacementModelCode?.trim() || null;
  const customerMessage = policy.customerMessage?.trim() || null;

  if (policy.status === "DISABLED" || policy.disabledAt) {
    return {
      policyId: policy.id,
      routable: false,
      excludeReason: "Deprecation policy DISABLED",
      replacementModelCode: replacement,
      customerMessage,
      announced: false,
    };
  }

  if (policy.status === "RETIRED") {
    return {
      policyId: policy.id,
      routable: false,
      excludeReason: "Deprecation policy RETIRED",
      replacementModelCode: replacement,
      customerMessage,
      announced: false,
    };
  }

  if (policy.status === "DEPRECATED") {
    return {
      policyId: policy.id,
      routable: false,
      excludeReason: "Deprecation policy DEPRECATED",
      replacementModelCode: replacement,
      customerMessage,
      announced: true,
    };
  }

  if (policy.status === "SUNSET_SCHEDULED") {
    const sunset = policy.sunsetDate;
    if (sunset && sunset.getTime() <= now.getTime()) {
      return {
        policyId: policy.id,
        routable: false,
        excludeReason: "Deprecation sunset date reached",
        replacementModelCode: replacement,
        customerMessage,
        announced: true,
      };
    }
    return {
      policyId: policy.id,
      routable: true,
      excludeReason: null,
      replacementModelCode: replacement,
      customerMessage,
      announced: true,
    };
  }

  if (policy.status === "DEPRECATION_ANNOUNCED") {
    return {
      policyId: policy.id,
      routable: true,
      excludeReason: null,
      replacementModelCode: replacement,
      customerMessage,
      announced: true,
    };
  }

  // ACTIVE — no lifecycle pressure yet
  return {
    policyId: policy.id,
    routable: true,
    excludeReason: null,
    replacementModelCode: replacement,
    customerMessage,
    announced: false,
  };
}
