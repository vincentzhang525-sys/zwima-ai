-- M8 Agent Platform Phase 1 (additive only)
-- Creates AgentToolBinding and AgentExecutionLog. Does NOT drop, rename, or
-- alter any existing table/column. This file is created for review only —
-- it must NOT be executed against Production or any shared database from
-- this workstream (no `prisma migrate deploy` / `db push` / `migrate dev`).

-- CreateTable
CREATE TABLE "AgentToolBinding" (
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

-- CreateTable
CREATE TABLE "AgentExecutionLog" (
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

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolBinding_bindingId_key" ON "AgentToolBinding"("bindingId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolBinding_agentId_key_agentVersionId_key" ON "AgentToolBinding"("agentId", "key", "agentVersionId");

-- CreateIndex
CREATE INDEX "AgentToolBinding_organizationId_agentId_enabled_idx" ON "AgentToolBinding"("organizationId", "agentId", "enabled");

-- CreateIndex
CREATE INDEX "AgentToolBinding_toolId_idx" ON "AgentToolBinding"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentExecutionLog_logId_key" ON "AgentExecutionLog"("logId");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_organizationId_createdAt_idx" ON "AgentExecutionLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_organizationId_agentId_createdAt_idx" ON "AgentExecutionLog"("organizationId", "agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_runId_idx" ON "AgentExecutionLog"("runId");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_event_idx" ON "AgentExecutionLog"("event");

-- AddForeignKey
ALTER TABLE "AgentToolBinding" ADD CONSTRAINT "AgentToolBinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecutionLog" ADD CONSTRAINT "AgentExecutionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
