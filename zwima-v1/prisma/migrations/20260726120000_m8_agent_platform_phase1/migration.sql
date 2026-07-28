-- M8 Agent Platform Phase 1 (additive only) — Preview-safe IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS "AgentToolBinding" (
    "id" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentVersionId" TEXT,
    "toolId" TEXT,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentToolBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentExecutionLog" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "agentId" TEXT,
    "runId" TEXT,
    "level" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentToolBinding_bindingId_key" ON "AgentToolBinding"("bindingId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentToolBinding_agentId_key_agentVersionId_key" ON "AgentToolBinding"("agentId", "key", "agentVersionId");
CREATE INDEX IF NOT EXISTS "AgentToolBinding_organizationId_agentId_enabled_idx" ON "AgentToolBinding"("organizationId", "agentId", "enabled");
CREATE INDEX IF NOT EXISTS "AgentToolBinding_toolId_idx" ON "AgentToolBinding"("toolId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentExecutionLog_logId_key" ON "AgentExecutionLog"("logId");
CREATE INDEX IF NOT EXISTS "AgentExecutionLog_organizationId_createdAt_idx" ON "AgentExecutionLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentExecutionLog_organizationId_agentId_createdAt_idx" ON "AgentExecutionLog"("organizationId", "agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentExecutionLog_runId_idx" ON "AgentExecutionLog"("runId");
CREATE INDEX IF NOT EXISTS "AgentExecutionLog_event_idx" ON "AgentExecutionLog"("event");

DO $$ BEGIN
  ALTER TABLE "AgentToolBinding" ADD CONSTRAINT "AgentToolBinding_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AgentExecutionLog" ADD CONSTRAINT "AgentExecutionLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
