-- M10 Enterprise Dashboard (additive only)
-- CREATE TYPE / TABLE / INDEX / FK only. No DROP / TRUNCATE / reset.

CREATE TYPE "DashboardExportFormat" AS ENUM ('JSON', 'CSV', 'PDF');
CREATE TYPE "DashboardExportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "DashboardSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "metricType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "sourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardSnapshot_organizationId_metricType_periodStart_idx" ON "DashboardSnapshot"("organizationId", "metricType", "periodStart");
CREATE INDEX "DashboardSnapshot_organizationId_workspaceId_generatedAt_idx" ON "DashboardSnapshot"("organizationId", "workspaceId", "generatedAt");
CREATE INDEX "DashboardSnapshot_expiresAt_idx" ON "DashboardSnapshot"("expiresAt");

CREATE TABLE "DashboardSavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "layout" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardSavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardSavedView_organizationId_userId_idx" ON "DashboardSavedView"("organizationId", "userId");
CREATE INDEX "DashboardSavedView_organizationId_workspaceId_idx" ON "DashboardSavedView"("organizationId", "workspaceId");

CREATE TABLE "DashboardExport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "format" "DashboardExportFormat" NOT NULL,
    "status" "DashboardExportStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "fileReference" TEXT,
    "integrityHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "DashboardExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardExport_organizationId_createdAt_idx" ON "DashboardExport"("organizationId", "createdAt");
CREATE INDEX "DashboardExport_organizationId_status_idx" ON "DashboardExport"("organizationId", "status");
CREATE INDEX "DashboardExport_requestedBy_createdAt_idx" ON "DashboardExport"("requestedBy", "createdAt");

CREATE TABLE "DashboardWidgetPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardWidgetPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardWidgetPreference_organizationId_userId_widgetKey_key" ON "DashboardWidgetPreference"("organizationId", "userId", "widgetKey");
CREATE INDEX "DashboardWidgetPreference_organizationId_userId_idx" ON "DashboardWidgetPreference"("organizationId", "userId");

CREATE TABLE "DashboardAlertPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold" DOUBLE PRECISION,
    "channels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardAlertPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardAlertPreference_organizationId_userId_alertKey_key" ON "DashboardAlertPreference"("organizationId", "userId", "alertKey");
CREATE INDEX "DashboardAlertPreference_organizationId_userId_idx" ON "DashboardAlertPreference"("organizationId", "userId");

ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardSavedView" ADD CONSTRAINT "DashboardSavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardSavedView" ADD CONSTRAINT "DashboardSavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardExport" ADD CONSTRAINT "DashboardExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardExport" ADD CONSTRAINT "DashboardExport_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardWidgetPreference" ADD CONSTRAINT "DashboardWidgetPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardWidgetPreference" ADD CONSTRAINT "DashboardWidgetPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardAlertPreference" ADD CONSTRAINT "DashboardAlertPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardAlertPreference" ADD CONSTRAINT "DashboardAlertPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
