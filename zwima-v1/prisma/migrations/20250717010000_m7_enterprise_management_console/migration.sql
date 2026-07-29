-- M7 Enterprise Management Console

CREATE TYPE "EnterpriseRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "EnterpriseInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "EnterpriseBillingStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');
CREATE TYPE "EnterpriseActivityCategory" AS ENUM ('LOGIN', 'USER', 'ADMIN', 'BILLING', 'API', 'TEAM', 'SETTINGS', 'SECURITY');

CREATE TABLE "EnterpriseOrgProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "legalName" TEXT,
  "displayName" TEXT,
  "industry" TEXT,
  "website" TEXT,
  "country" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "taxId" TEXT,
  "billingEmail" TEXT,
  "supportEmail" TEXT,
  "businessSettings" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseOrgProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseWorkspace" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "settings" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseDepartment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseTeam" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseTeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "email" TEXT NOT NULL,
  "roleCode" TEXT NOT NULL DEFAULT 'MEMBER',
  "tokenHash" TEXT NOT NULL,
  "status" "EnterpriseInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invitedBy" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseRole" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isCustom" BOOLEAN NOT NULL DEFAULT true,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseMemberRole" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseMemberRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseApiAccess" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "apiKeyId" TEXT,
  "name" TEXT NOT NULL,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "dailyQuota" INTEGER,
  "monthlyQuota" INTEGER,
  "rpmLimit" INTEGER,
  "usageLimit" INTEGER,
  "currentDailyUsage" INTEGER NOT NULL DEFAULT 0,
  "currentMonthlyUsage" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseApiAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseCostCenter" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "budgetEur" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "spentEur" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "status" "EnterpriseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseCostCenter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseBillingAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planCode" TEXT NOT NULL DEFAULT 'ENTERPRISE',
  "status" "EnterpriseBillingStatus" NOT NULL DEFAULT 'ACTIVE',
  "billingEmail" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "subscriptionRef" TEXT,
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseBillingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseActivityLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "category" "EnterpriseActivityCategory" NOT NULL DEFAULT 'ADMIN',
  "detail" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnterpriseAuditEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseAuditEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "EnterpriseOrgProfile_organizationId_key" ON "EnterpriseOrgProfile"("organizationId");
CREATE INDEX "EnterpriseOrgProfile_organizationId_idx" ON "EnterpriseOrgProfile"("organizationId");

CREATE UNIQUE INDEX "EnterpriseWorkspace_organizationId_workspaceKey_key" ON "EnterpriseWorkspace"("organizationId", "workspaceKey");
CREATE INDEX "EnterpriseWorkspace_organizationId_status_idx" ON "EnterpriseWorkspace"("organizationId", "status");

CREATE UNIQUE INDEX "EnterpriseDepartment_organizationId_code_key" ON "EnterpriseDepartment"("organizationId", "code");
CREATE INDEX "EnterpriseDepartment_organizationId_status_idx" ON "EnterpriseDepartment"("organizationId", "status");

CREATE UNIQUE INDEX "EnterpriseTeam_organizationId_code_key" ON "EnterpriseTeam"("organizationId", "code");
CREATE INDEX "EnterpriseTeam_organizationId_status_idx" ON "EnterpriseTeam"("organizationId", "status");
CREATE INDEX "EnterpriseTeam_departmentId_idx" ON "EnterpriseTeam"("departmentId");

CREATE UNIQUE INDEX "EnterpriseTeamMember_teamId_userId_key" ON "EnterpriseTeamMember"("teamId", "userId");
CREATE INDEX "EnterpriseTeamMember_organizationId_userId_idx" ON "EnterpriseTeamMember"("organizationId", "userId");

CREATE INDEX "EnterpriseInvitation_organizationId_status_idx" ON "EnterpriseInvitation"("organizationId", "status");
CREATE INDEX "EnterpriseInvitation_email_status_idx" ON "EnterpriseInvitation"("email", "status");
CREATE UNIQUE INDEX "EnterpriseInvitation_organizationId_email_status_key" ON "EnterpriseInvitation"("organizationId", "email", "status");

CREATE UNIQUE INDEX "EnterpriseRole_organizationId_code_key" ON "EnterpriseRole"("organizationId", "code");
CREATE INDEX "EnterpriseRole_organizationId_status_idx" ON "EnterpriseRole"("organizationId", "status");

-- UNIQUE(organizationId, userId, roleId) — workspaceId nullable; PG treats NULLs as distinct in multi-column uniques
CREATE UNIQUE INDEX "EnterpriseMemberRole_organizationId_userId_roleId_key" ON "EnterpriseMemberRole"("organizationId", "userId", "roleId");
CREATE INDEX "EnterpriseMemberRole_organizationId_userId_idx" ON "EnterpriseMemberRole"("organizationId", "userId");
CREATE INDEX "EnterpriseMemberRole_roleId_idx" ON "EnterpriseMemberRole"("roleId");

CREATE INDEX "EnterpriseApiAccess_organizationId_status_idx" ON "EnterpriseApiAccess"("organizationId", "status");
CREATE INDEX "EnterpriseApiAccess_apiKeyId_idx" ON "EnterpriseApiAccess"("apiKeyId");

CREATE UNIQUE INDEX "EnterpriseCostCenter_organizationId_code_key" ON "EnterpriseCostCenter"("organizationId", "code");
CREATE INDEX "EnterpriseCostCenter_organizationId_status_idx" ON "EnterpriseCostCenter"("organizationId", "status");

CREATE UNIQUE INDEX "EnterpriseBillingAccount_organizationId_key" ON "EnterpriseBillingAccount"("organizationId");
CREATE INDEX "EnterpriseBillingAccount_status_idx" ON "EnterpriseBillingAccount"("status");

CREATE INDEX "EnterpriseActivityLog_organizationId_createdAt_idx" ON "EnterpriseActivityLog"("organizationId", "createdAt");
CREATE INDEX "EnterpriseActivityLog_organizationId_category_idx" ON "EnterpriseActivityLog"("organizationId", "category");
CREATE INDEX "EnterpriseActivityLog_actorUserId_createdAt_idx" ON "EnterpriseActivityLog"("actorUserId", "createdAt");

CREATE INDEX "EnterpriseAuditEvent_organizationId_createdAt_idx" ON "EnterpriseAuditEvent"("organizationId", "createdAt");
CREATE INDEX "EnterpriseAuditEvent_eventType_createdAt_idx" ON "EnterpriseAuditEvent"("eventType", "createdAt");

-- Foreign keys (Organization + cross-M7 relations); ON DELETE RESTRICT
ALTER TABLE "EnterpriseOrgProfile" ADD CONSTRAINT "EnterpriseOrgProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseWorkspace" ADD CONSTRAINT "EnterpriseWorkspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseDepartment" ADD CONSTRAINT "EnterpriseDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseTeam" ADD CONSTRAINT "EnterpriseTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseTeam" ADD CONSTRAINT "EnterpriseTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EnterpriseDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseTeamMember" ADD CONSTRAINT "EnterpriseTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "EnterpriseTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseInvitation" ADD CONSTRAINT "EnterpriseInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseInvitation" ADD CONSTRAINT "EnterpriseInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "EnterpriseWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseRole" ADD CONSTRAINT "EnterpriseRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseMemberRole" ADD CONSTRAINT "EnterpriseMemberRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMemberRole" ADD CONSTRAINT "EnterpriseMemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "EnterpriseRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseMemberRole" ADD CONSTRAINT "EnterpriseMemberRole_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "EnterpriseWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseApiAccess" ADD CONSTRAINT "EnterpriseApiAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseApiAccess" ADD CONSTRAINT "EnterpriseApiAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "EnterpriseWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseCostCenter" ADD CONSTRAINT "EnterpriseCostCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseBillingAccount" ADD CONSTRAINT "EnterpriseBillingAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseActivityLog" ADD CONSTRAINT "EnterpriseActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnterpriseAuditEvent" ADD CONSTRAINT "EnterpriseAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security
ALTER TABLE public."EnterpriseOrgProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseWorkspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseDepartment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseTeam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseTeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseMemberRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseApiAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseCostCenter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseBillingAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnterpriseAuditEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "EnterpriseOrgProfile_select" ON public."EnterpriseOrgProfile"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseOrgProfile_write" ON public."EnterpriseOrgProfile"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseWorkspace_select" ON public."EnterpriseWorkspace"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseWorkspace_write" ON public."EnterpriseWorkspace"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseDepartment_select" ON public."EnterpriseDepartment"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseDepartment_write" ON public."EnterpriseDepartment"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseTeam_select" ON public."EnterpriseTeam"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseTeam_write" ON public."EnterpriseTeam"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseTeamMember_select" ON public."EnterpriseTeamMember"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseTeamMember_write" ON public."EnterpriseTeamMember"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseInvitation_select" ON public."EnterpriseInvitation"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseInvitation_write" ON public."EnterpriseInvitation"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseRole_select" ON public."EnterpriseRole"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseRole_write" ON public."EnterpriseRole"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseMemberRole_select" ON public."EnterpriseMemberRole"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseMemberRole_write" ON public."EnterpriseMemberRole"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseApiAccess_select" ON public."EnterpriseApiAccess"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseApiAccess_write" ON public."EnterpriseApiAccess"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseCostCenter_select" ON public."EnterpriseCostCenter"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseCostCenter_write" ON public."EnterpriseCostCenter"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseBillingAccount_select" ON public."EnterpriseBillingAccount"
  FOR SELECT USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"));
CREATE POLICY "EnterpriseBillingAccount_write" ON public."EnterpriseBillingAccount"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseActivityLog_all" ON public."EnterpriseActivityLog"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));

CREATE POLICY "EnterpriseAuditEvent_all" ON public."EnterpriseAuditEvent"
  FOR ALL USING (public.is_service_role() OR public.is_platform_admin() OR public.is_org_member("organizationId"))
  WITH CHECK (public.is_service_role() OR public.is_platform_admin() OR public.is_org_admin("organizationId"));
