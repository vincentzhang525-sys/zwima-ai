-- M5.6 Model Health History Management (additive)

CREATE TYPE "HealthIncidentType" AS ENUM (
  'OUTAGE', 'DEGRADED_PERFORMANCE', 'HIGH_LATENCY', 'HIGH_ERROR_RATE',
  'RATE_LIMITING', 'REGION_FAILURE', 'PROVIDER_FAILURE', 'MAINTENANCE', 'SECURITY', 'UNKNOWN'
);
CREATE TYPE "HealthIncidentSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "HealthIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'MITIGATING', 'RESOLVED', 'CLOSED');
CREATE TYPE "HealthAggregateGranularity" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "ModelHealthObservation" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "providerId" TEXT,
    "modelRegistryId" TEXT NOT NULL,
    "modelVersionId" TEXT,
    "region" TEXT,
    "availabilityStatus" "ModelAvailabilityState",
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "availabilityPercent" DOUBLE PRECISION,
    "latencyP50Ms" INTEGER,
    "latencyP95Ms" INTEGER,
    "latencyP99Ms" INTEGER,
    "averageLatencyMs" INTEGER,
    "errorRate" DECIMAL(8,6),
    "timeoutRate" DECIMAL(8,6),
    "rateLimitHitCount" INTEGER NOT NULL DEFAULT 0,
    "tokenUsage" JSONB,
    "source" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelHealthObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelHealthIncident" (
    "id" TEXT NOT NULL,
    "incidentKey" TEXT NOT NULL,
    "providerId" TEXT,
    "modelRegistryId" TEXT,
    "modelVersionId" TEXT,
    "region" TEXT,
    "incidentType" "HealthIncidentType" NOT NULL,
    "severity" "HealthIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "HealthIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rootCause" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "mitigatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "impactSummary" TEXT,
    "affectedRequests" INTEGER,
    "affectedOrganizations" INTEGER,
    "externalReference" TEXT,
    "source" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelHealthIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelHealthIncidentHistory" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "note" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelHealthIncidentHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelHealthAggregate" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "modelRegistryId" TEXT,
    "modelVersionId" TEXT,
    "region" TEXT,
    "granularity" "HealthAggregateGranularity" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "availabilityPercent" DOUBLE PRECISION,
    "averageLatencyMs" INTEGER,
    "latencyP50Ms" INTEGER,
    "latencyP95Ms" INTEGER,
    "latencyP99Ms" INTEGER,
    "errorRate" DECIMAL(8,6),
    "timeoutRate" DECIMAL(8,6),
    "rateLimitHitCount" INTEGER NOT NULL DEFAULT 0,
    "incidentCount" INTEGER NOT NULL DEFAULT 0,
    "criticalIncidentCount" INTEGER NOT NULL DEFAULT 0,
    "slaTarget" DOUBLE PRECISION,
    "slaAchieved" BOOLEAN,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelHealthAggregate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelHealthSlaPolicy" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "modelRegistryId" TEXT,
    "modelVersionId" TEXT,
    "region" TEXT,
    "availabilityTarget" DOUBLE PRECISION NOT NULL,
    "latencyP95TargetMs" INTEGER,
    "errorRateTarget" DECIMAL(8,6),
    "evaluationWindow" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelHealthSlaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelHealthObservation_observationId_key" ON "ModelHealthObservation"("observationId");
CREATE UNIQUE INDEX "ModelHealthIncident_incidentKey_key" ON "ModelHealthIncident"("incidentKey");

CREATE UNIQUE INDEX "ModelHealthAggregate_unique_period"
  ON "ModelHealthAggregate"(
    COALESCE("providerId", ''),
    COALESCE("modelRegistryId", ''),
    COALESCE("modelVersionId", ''),
    COALESCE("region", ''),
    "granularity",
    "periodStart"
  );

CREATE INDEX "ModelHealthObservation_modelRegistryId_observedAt_idx" ON "ModelHealthObservation"("modelRegistryId", "observedAt");
CREATE INDEX "ModelHealthObservation_modelVersionId_observedAt_idx" ON "ModelHealthObservation"("modelVersionId", "observedAt");
CREATE INDEX "ModelHealthObservation_providerId_region_observedAt_idx" ON "ModelHealthObservation"("providerId", "region", "observedAt");
CREATE INDEX "ModelHealthObservation_windowStart_windowEnd_idx" ON "ModelHealthObservation"("windowStart", "windowEnd");

CREATE INDEX "ModelHealthIncident_status_severity_idx" ON "ModelHealthIncident"("status", "severity");
CREATE INDEX "ModelHealthIncident_modelRegistryId_startedAt_idx" ON "ModelHealthIncident"("modelRegistryId", "startedAt");
CREATE INDEX "ModelHealthIncident_providerId_startedAt_idx" ON "ModelHealthIncident"("providerId", "startedAt");

CREATE INDEX "ModelHealthIncidentHistory_incidentId_createdAt_idx" ON "ModelHealthIncidentHistory"("incidentId", "createdAt");

CREATE INDEX "ModelHealthAggregate_modelRegistryId_granularity_periodStart_idx"
  ON "ModelHealthAggregate"("modelRegistryId", "granularity", "periodStart");
CREATE INDEX "ModelHealthAggregate_periodStart_periodEnd_idx" ON "ModelHealthAggregate"("periodStart", "periodEnd");

CREATE INDEX "ModelHealthSlaPolicy_modelRegistryId_isActive_idx" ON "ModelHealthSlaPolicy"("modelRegistryId", "isActive");
CREATE INDEX "ModelHealthSlaPolicy_modelVersionId_isActive_idx" ON "ModelHealthSlaPolicy"("modelVersionId", "isActive");
CREATE INDEX "ModelHealthSlaPolicy_providerId_isActive_idx" ON "ModelHealthSlaPolicy"("providerId", "isActive");

ALTER TABLE "ModelHealthObservation" ADD CONSTRAINT "ModelHealthObservation_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthObservation" ADD CONSTRAINT "ModelHealthObservation_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthObservation" ADD CONSTRAINT "ModelHealthObservation_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelHealthIncident" ADD CONSTRAINT "ModelHealthIncident_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthIncident" ADD CONSTRAINT "ModelHealthIncident_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthIncident" ADD CONSTRAINT "ModelHealthIncident_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelHealthIncidentHistory" ADD CONSTRAINT "ModelHealthIncidentHistory_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "ModelHealthIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelHealthAggregate" ADD CONSTRAINT "ModelHealthAggregate_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthAggregate" ADD CONSTRAINT "ModelHealthAggregate_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthAggregate" ADD CONSTRAINT "ModelHealthAggregate_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelHealthSlaPolicy" ADD CONSTRAINT "ModelHealthSlaPolicy_modelRegistryId_fkey"
  FOREIGN KEY ("modelRegistryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthSlaPolicy" ADD CONSTRAINT "ModelHealthSlaPolicy_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelHealthSlaPolicy" ADD CONSTRAINT "ModelHealthSlaPolicy_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE public."ModelHealthObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelHealthIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelHealthIncidentHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelHealthAggregate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModelHealthSlaPolicy" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ModelHealthObservation_select" ON public."ModelHealthObservation";
CREATE POLICY "ModelHealthObservation_select" ON public."ModelHealthObservation"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelHealthObservation_service_write" ON public."ModelHealthObservation";
CREATE POLICY "ModelHealthObservation_service_write" ON public."ModelHealthObservation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelHealthIncident_select" ON public."ModelHealthIncident";
CREATE POLICY "ModelHealthIncident_select" ON public."ModelHealthIncident"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelHealthIncident_admin_write" ON public."ModelHealthIncident";
CREATE POLICY "ModelHealthIncident_admin_write" ON public."ModelHealthIncident"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelHealthIncidentHistory_select" ON public."ModelHealthIncidentHistory";
CREATE POLICY "ModelHealthIncidentHistory_select" ON public."ModelHealthIncidentHistory"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelHealthIncidentHistory_service_write" ON public."ModelHealthIncidentHistory";
CREATE POLICY "ModelHealthIncidentHistory_service_write" ON public."ModelHealthIncidentHistory"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelHealthAggregate_select" ON public."ModelHealthAggregate";
CREATE POLICY "ModelHealthAggregate_select" ON public."ModelHealthAggregate"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelHealthAggregate_service_write" ON public."ModelHealthAggregate";
CREATE POLICY "ModelHealthAggregate_service_write" ON public."ModelHealthAggregate"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());

DROP POLICY IF EXISTS "ModelHealthSlaPolicy_select" ON public."ModelHealthSlaPolicy";
CREATE POLICY "ModelHealthSlaPolicy_select" ON public."ModelHealthSlaPolicy"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.requesting_clerk_id() IS NOT NULL);
DROP POLICY IF EXISTS "ModelHealthSlaPolicy_admin_write" ON public."ModelHealthSlaPolicy";
CREATE POLICY "ModelHealthSlaPolicy_admin_write" ON public."ModelHealthSlaPolicy"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin())
  WITH CHECK (public.is_service_role() OR public.is_platform_admin());
