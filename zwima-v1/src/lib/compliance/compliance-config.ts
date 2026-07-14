export type GdprFlags = {
  euDataResidency?: boolean;
  requiresDpa?: boolean;
  lawfulBasis?: "consent" | "contract" | "legitimate_interest" | "legal_obligation" | null;
  retentionDays?: number | null;
  dataMinimization?: boolean;
  rightToErasure?: boolean;
  crossBorderTransfer?: boolean;
};

export type ComplianceConfigPayload = {
  adminNotes?: string;
  removalDate?: string | null;
  gdpr?: GdprFlags;
};

export function parseComplianceNotes(notes: string | null | undefined): ComplianceConfigPayload {
  if (!notes?.trim()) return {};
  try {
    const parsed = JSON.parse(notes) as ComplianceConfigPayload;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return { adminNotes: notes };
  }
  return { adminNotes: notes };
}

export function serializeComplianceNotes(payload: ComplianceConfigPayload): string | null {
  const hasStructured =
    payload.removalDate !== undefined ||
    payload.gdpr !== undefined ||
    (payload.adminNotes !== undefined && payload.adminNotes !== "");

  if (!hasStructured && !payload.adminNotes) return null;

  if (!payload.gdpr && payload.removalDate === undefined && payload.adminNotes) {
    return payload.adminNotes;
  }

  return JSON.stringify(payload);
}

export function mergeCompliancePayload(
  existing: string | null | undefined,
  patch: Partial<ComplianceConfigPayload>,
): string | null {
  const base = parseComplianceNotes(existing);
  return serializeComplianceNotes({
    ...base,
    ...patch,
    gdpr: { ...base.gdpr, ...patch.gdpr },
  });
}
