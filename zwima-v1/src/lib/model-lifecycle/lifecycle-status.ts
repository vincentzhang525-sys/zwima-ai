import type { ProviderModelStatus } from "@prisma/client";

/** Admin-facing lifecycle labels mapped to DB enum (no schema change). */
export type AdminModelStatus = "ACTIVE" | "PREVIEW" | "DEPRECATED" | "DISABLED";

const TO_DB: Record<AdminModelStatus, ProviderModelStatus> = {
  ACTIVE: "ACTIVE",
  PREVIEW: "PREVIEW",
  DEPRECATED: "DEPRECATED",
  DISABLED: "INACTIVE",
};

const FROM_DB: Partial<Record<ProviderModelStatus, AdminModelStatus>> = {
  ACTIVE: "ACTIVE",
  PREVIEW: "PREVIEW",
  DEPRECATED: "DEPRECATED",
  INACTIVE: "DISABLED",
  SUNSET: "DEPRECATED",
  DRAFT: "DISABLED",
};

export function toDbStatus(status: AdminModelStatus | ProviderModelStatus): ProviderModelStatus {
  if (status in TO_DB) return TO_DB[status as AdminModelStatus];
  return status as ProviderModelStatus;
}

export function toAdminStatus(status: ProviderModelStatus): AdminModelStatus {
  return FROM_DB[status] ?? "DISABLED";
}

export const ADMIN_LIFECYCLE_STATUSES: AdminModelStatus[] = [
  "ACTIVE",
  "PREVIEW",
  "DEPRECATED",
  "DISABLED",
];
