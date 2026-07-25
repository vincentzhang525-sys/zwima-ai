# Production Route Capability Inventory

**Source:** compiled Lambda outputs from `dpl_B5bKq3iRUvgErsvAc7uLhxEhhA1v`
**Generated:** 2026-07-25T20:21:01.509Z

## Summary

| Metric | Count |
|--------|------:|
| Extracted paths (incl. `.rsc`) | 1458 |
| Unique application paths | 729 |
| Framework/generated markers (`.rsc` / `_`) | 729 |

> 1457 Lambdas ≠ 1457 source files. Many API routes share one serverless bundle digest.

## Groups

### admin (107)

- `api/admin/agent-metrics`
- `api/admin/agent-policies`
- `api/admin/agent-runs`
- `api/admin/agents`
- `api/admin/audit`
- `api/admin/billing/dashboard`
- `api/admin/billing/sync-stripe-prices`
- `api/admin/compliance`
- `api/admin/compliance/disclaimers`
- `api/admin/compliance/mock-event`
- `api/admin/compliance/policies`
- `api/admin/compliance/policies/[id]`
- `api/admin/compliance/provider-regions`
- `api/admin/compliance/provider-regions/[id]`
- `api/admin/compliance/regions`
- `api/admin/compliance/regions/[id]`
- `api/admin/compliance/regulatory`
- `api/admin/compliance/retention-dry-run`
- `api/admin/compliance/retention-policies`
- `api/admin/console`
- `api/admin/cost-calculator`
- `api/admin/cost-engine`
- `api/admin/cost/dashboard`
- `api/admin/dashboard/activity`
- `api/admin/dashboard/agents`
- `api/admin/dashboard/compliance`
- `api/admin/dashboard/financials`
- `api/admin/dashboard/incidents`
- `api/admin/dashboard/models`
- `api/admin/dashboard/organizations`
- `api/admin/dashboard/overview`
- `api/admin/dashboard/providers`
- `api/admin/dashboard/system-health`
- `api/admin/dashboard/workflows`
- `api/admin/email/test`
- `api/admin/enterprise/overview`
- `api/admin/infrastructure/backups`
- `api/admin/infrastructure/environments`
- `api/admin/infrastructure/incidents`
- `api/admin/infrastructure/jobs/[id]/cancel`
- `api/admin/infrastructure/jobs/[id]/retry`
- `api/admin/infrastructure/rate-limits`
- `api/admin/infrastructure/releases`
- `api/admin/infrastructure/releases/[id]/approve`
- `api/admin/infrastructure/releases/[id]/block`
- `api/admin/infrastructure/restore-drills`
- `api/admin/infrastructure/services`
- `api/admin/lifecycle`
- `api/admin/margins`
- `api/admin/model-migration`
- `api/admin/model-registry`
- `api/admin/model-registry/[id]`
- `api/admin/models`
- `api/admin/ops-dashboard`
- `api/admin/packages`
- `api/admin/pricing`
- `api/admin/pricing-records`
- `api/admin/prompts`
- `api/admin/providers`
- `api/admin/revenue`
- `api/admin/routing`
- `api/admin/routing/decisions`
- `api/admin/routing/decisions/[id]`
- `api/admin/routing/overview`
- `api/admin/routing/policies`
- `api/admin/routing/simulate`
- `api/admin/security-events`
- `api/admin/tools`
- `api/admin/workflows/executions`
- `api/admin/workflows/failures`
- `api/admin/workflows/mock-execution`
- `api/admin/workflows/overview`
- `api/admin/workflows/policies`
- `dashboard/admin`
- `dashboard/admin/activity`
- `dashboard/admin/agent-metrics`
- `dashboard/admin/agent-policies`
- `dashboard/admin/agent-runs`
- `dashboard/admin/agents`
- `dashboard/admin/audit`
- … +27 more

### agents_apis (11)

- `api/v1/agents`
- `api/v1/agents/[id]`
- `api/v1/agents/[id]/config`
- `api/v1/agents/[id]/publish`
- `api/v1/agents/[id]/runs`
- `api/v1/agents/runs/[id]/approval`
- `api/v1/agents/runs/[id]/resources`
- `api/v1/agents/runs/[id]/rollback`
- `api/v1/agents/runs/[id]/tools`
- `api/v1/agents/seed`
- `api/v1/dashboard/agents`

### api_routes (341)

- `api/api-keys`
- `api/api-keys/[id]`
- `api/audit`
- `api/auth/register`
- `api/dashboard/analytics`
- `api/dashboard/stats`
- `api/internal/compliance/automation/process-events`
- `api/internal/compliance/automation/run-scheduled`
- `api/internal/compliance/regulatory/scan-pending`
- `api/internal/model-availability/error-rate`
- `api/internal/model-availability/expire-stale`
- `api/internal/model-availability/latency`
- `api/internal/model-availability/maintenance`
- `api/internal/model-availability/observations`
- `api/internal/model-availability/rate-limit`
- `api/internal/model-availability/region-restriction`
- `api/internal/model-discovery/apply-approved`
- `api/internal/model-discovery/run-scheduled`
- `api/internal/model-discovery/run/[sourceId]`
- `api/internal/model-lifecycle/actions/execute`
- `api/internal/model-lifecycle/readiness/recalculate`
- `api/internal/model-lifecycle/reports/refresh`
- `api/internal/model-lifecycle/snapshots/create`
- `api/model-registry`
- `api/model-registry/[id]`
- `api/notifications`
- `api/notifications/[id]`
- `api/playground`
- `api/team`
- `api/usage/history`
- `api/v1/agent-memory`
- `api/v1/agent-memory/[id]`
- `api/v1/agent-reviews`
- `api/v1/agent-runs`
- `api/v1/agent-runs/[id]`
- `api/v1/agent-runs/[id]/cancel`
- `api/v1/agent-runs/[id]/execute`
- `api/v1/agent-runs/[id]/retry`
- `api/v1/api-keys`
- `api/v1/api-keys/[id]`
- `api/v1/api-keys/[id]/revoke`
- `api/v1/api-keys/[id]/rotate`
- `api/v1/audit`
- `api/v1/chat`
- `api/v1/chat/stream`
- `api/v1/compliance/actions-required`
- `api/v1/compliance/ai-systems`
- `api/v1/compliance/ai-systems/[systemId]`
- `api/v1/compliance/ai-systems/[systemId]/approve`
- `api/v1/compliance/ai-systems/[systemId]/archive`
- `api/v1/compliance/ai-systems/[systemId]/conditional-approve`
- `api/v1/compliance/ai-systems/[systemId]/data-categories`
- `api/v1/compliance/ai-systems/[systemId]/data-categories/[recordId]`
- `api/v1/compliance/ai-systems/[systemId]/deployments`
- `api/v1/compliance/ai-systems/[systemId]/history`
- `api/v1/compliance/ai-systems/[systemId]/intended-purpose`
- `api/v1/compliance/ai-systems/[systemId]/intended-purpose/versions`
- `api/v1/compliance/ai-systems/[systemId]/operator-roles`
- `api/v1/compliance/ai-systems/[systemId]/operator-roles/[roleId]`
- `api/v1/compliance/ai-systems/[systemId]/reject`
- `api/v1/compliance/ai-systems/[systemId]/reopen`
- `api/v1/compliance/ai-systems/[systemId]/request-information`
- `api/v1/compliance/ai-systems/[systemId]/submit-review`
- `api/v1/compliance/ai-systems/[systemId]/suspend`
- `api/v1/compliance/audit`
- `api/v1/compliance/audit/[sessionId]`
- `api/v1/compliance/audit/[sessionId]/actions`
- `api/v1/compliance/audit/[sessionId]/evidence`
- `api/v1/compliance/audit/[sessionId]/export`
- `api/v1/compliance/audit/[sessionId]/history`
- `api/v1/compliance/audit/[sessionId]/review`
- `api/v1/compliance/audit/corrective-actions`
- `api/v1/compliance/audit/overview`
- `api/v1/compliance/audit/reports`
- `api/v1/compliance/audit/timeline`
- `api/v1/compliance/automation`
- `api/v1/compliance/automation/events`
- `api/v1/compliance/automation/events/[eventId]`
- `api/v1/compliance/automation/events/[eventId]/process`
- `api/v1/compliance/automation/events/[eventId]/retry`
- … +261 more

### authentication_pages (4)

- `forgot-password`
- `login`
- `signup`
- `sso-callback`

### billing_packages (15)

- `api/billing/checkout`
- `api/v1/billing`
- `api/v1/billing/enterprise`
- `api/v1/billing/invoices`
- `api/v1/billing/settlement`
- `api/v1/billing/subscriptions`
- `api/v1/billing/usage`
- `api/v1/billing/wallet`
- `api/v1/enterprise/billing`
- `api/v1/invoices`
- `api/v1/invoices/[id]/pdf`
- `api/v1/packages`
- `api/v1/recharge`
- `api/workspace/billing`
- `api/workspace/invoices`

### dashboard_pages (105)

- `dashboard/activity`
- `dashboard/agent-memory`
- `dashboard/agent-reviews`
- `dashboard/agent-runs/[id]`
- `dashboard/agents`
- `dashboard/agents/[id]`
- `dashboard/agents/[id]/config`
- `dashboard/agents/[id]/runs`
- `dashboard/agents/new`
- `dashboard/agents/overview`
- `dashboard/analytics`
- `dashboard/api-keys`
- `dashboard/audit`
- `dashboard/balance`
- `dashboard/billing`
- `dashboard/compliance`
- `dashboard/compliance/actions-required`
- `dashboard/compliance/ai-systems`
- `dashboard/compliance/ai-systems/[systemId]`
- `dashboard/compliance/audit`
- `dashboard/compliance/audit/[sessionId]`
- `dashboard/compliance/automation`
- `dashboard/compliance/automation/events`
- `dashboard/compliance/automation/evidence-collection`
- `dashboard/compliance/automation/monitoring`
- `dashboard/compliance/automation/notifications`
- `dashboard/compliance/automation/recommendations`
- `dashboard/compliance/automation/reports`
- `dashboard/compliance/automation/reviews`
- `dashboard/compliance/automation/rules`
- `dashboard/compliance/automation/runs`
- `dashboard/compliance/automation/tasks`
- `dashboard/compliance/documentation`
- `dashboard/compliance/documentation/[documentId]`
- `dashboard/compliance/evidence`
- `dashboard/compliance/operator-roles`
- `dashboard/compliance/overview`
- `dashboard/compliance/regulatory`
- `dashboard/compliance/regulatory/changes`
- `dashboard/compliance/regulatory/changes/[changeId]`
- `dashboard/compliance/regulatory/sources`
- `dashboard/compliance/regulatory/transitions`
- `dashboard/compliance/review-queue`
- `dashboard/compliance/risk`
- `dashboard/compliance/runtime`
- `dashboard/enterprise`
- `dashboard/enterprise/api-access`
- `dashboard/enterprise/audit`
- `dashboard/enterprise/billing`
- `dashboard/enterprise/profile`
- `dashboard/enterprise/roles`
- `dashboard/enterprise/team`
- `dashboard/enterprise/workspaces`
- `dashboard/exports`
- `dashboard/financials`
- `dashboard/infrastructure`
- `dashboard/invoices`
- `dashboard/logs`
- `dashboard/model-availability`
- `dashboard/model-capabilities`
- `dashboard/model-deprecation`
- `dashboard/model-discovery`
- `dashboard/model-health`
- `dashboard/model-lifecycle`
- `dashboard/model-lifecycle/actions`
- `dashboard/model-lifecycle/availability`
- `dashboard/model-lifecycle/deprecations`
- `dashboard/model-lifecycle/discovery`
- `dashboard/model-lifecycle/health`
- `dashboard/model-lifecycle/models`
- `dashboard/model-lifecycle/models/[modelId]`
- `dashboard/model-lifecycle/models/[modelId]/versions/[versionId]`
- `dashboard/model-lifecycle/provider-sync`
- `dashboard/model-lifecycle/readiness`
- `dashboard/model-lifecycle/release-channels`
- `dashboard/model-lifecycle/reports`
- `dashboard/model-lifecycle/risks`
- `dashboard/model-lifecycle/snapshots`
- `dashboard/model-lifecycle/timeline`
- `dashboard/model-registry`
- … +25 more

### health_monitoring (35)

- `api/health`
- `api/health/live`
- `api/health/ready`
- `api/internal/model-health/aggregate`
- `api/internal/model-health/detect-incidents`
- `api/internal/model-health/observations`
- `api/internal/model-health/observations/batch`
- `api/internal/model-health/rebuild-aggregates`
- `api/v1/dashboard/health`
- `api/v1/health`
- `api/v1/infrastructure/health`
- `api/v1/model-health`
- `api/v1/model-health/availability`
- `api/v1/model-health/compare`
- `api/v1/model-health/errors`
- `api/v1/model-health/incidents`
- `api/v1/model-health/incidents/[incidentId]`
- `api/v1/model-health/incidents/[incidentId]/acknowledge`
- `api/v1/model-health/incidents/[incidentId]/close`
- `api/v1/model-health/incidents/[incidentId]/history`
- `api/v1/model-health/incidents/[incidentId]/mitigate`
- `api/v1/model-health/incidents/[incidentId]/resolve`
- `api/v1/model-health/latency`
- `api/v1/model-health/rate-limits`
- `api/v1/model-health/score`
- `api/v1/model-health/sla`
- `api/v1/model-health/sla/[slaPolicyId]`
- `api/v1/model-health/sla/evaluation`
- `api/v1/model-health/sla/history`
- `api/v1/model-health/summary`
- `api/v1/model-health/timeline`
- `api/v1/model-lifecycle/reports/health`
- `api/v1/models/[modelId]/health`
- `api/v1/models/[modelId]/versions/[versionId]/health`
- `api/v1/providers/[providerId]/health`

### middleware (1)

- `src/middleware`

### other (3)

- `dashboard`
- `legal/dpa`
- `legal/sub-processors`

### provider_models (99)

- `api/internal/model-availability/provider-outage`
- `api/internal/provider-sync/execute/[jobId]`
- `api/internal/provider-sync/plan-approved`
- `api/internal/provider-sync/retry-failed`
- `api/internal/provider-sync/run-scheduled`
- `api/v1/compliance/ai-systems/[systemId]/models`
- `api/v1/compliance/ai-systems/[systemId]/models/[mappingId]`
- `api/v1/compliance/ai-systems/[systemId]/providers`
- `api/v1/dashboard/models`
- `api/v1/dashboard/providers`
- `api/v1/model-discovery/changed-models`
- `api/v1/model-discovery/missing-models`
- `api/v1/model-discovery/new-models`
- `api/v1/model-discovery/provider-status`
- `api/v1/model-lifecycle/models`
- `api/v1/model-lifecycle/models/[modelId]`
- `api/v1/model-lifecycle/models/[modelId]/readiness`
- `api/v1/model-lifecycle/models/[modelId]/recommendations`
- `api/v1/model-lifecycle/models/[modelId]/related-resources`
- `api/v1/model-lifecycle/models/[modelId]/summary`
- `api/v1/model-lifecycle/models/[modelId]/timeline`
- `api/v1/model-lifecycle/models/[modelId]/versions`
- `api/v1/model-lifecycle/models/[modelId]/versions/[versionId]`
- `api/v1/model-lifecycle/models/[modelId]/versions/[versionId]/readiness`
- `api/v1/model-lifecycle/models/[modelId]/versions/[versionId]/timeline`
- `api/v1/model-lifecycle/models/batch-get`
- `api/v1/model-lifecycle/providers`
- `api/v1/models`
- `api/v1/models/[modelId]/availability`
- `api/v1/models/[modelId]/availability/regions`
- `api/v1/models/[modelId]/capabilities`
- `api/v1/models/[modelId]/capabilities/[capabilityId]`
- `api/v1/models/[modelId]/deprecation`
- `api/v1/models/[modelId]/effective-availability`
- `api/v1/models/[modelId]/effective-capabilities`
- `api/v1/models/[modelId]/effective-deprecation`
- `api/v1/models/[modelId]/release-channels`
- `api/v1/models/[modelId]/version-history`
- `api/v1/models/[modelId]/versions`
- `api/v1/models/[modelId]/versions/[versionId]`
- `api/v1/models/[modelId]/versions/[versionId]/access`
- `api/v1/models/[modelId]/versions/[versionId]/availability`
- `api/v1/models/[modelId]/versions/[versionId]/availability/regions`
- `api/v1/models/[modelId]/versions/[versionId]/capabilities`
- `api/v1/models/[modelId]/versions/[versionId]/capabilities/[capabilityId]`
- `api/v1/models/[modelId]/versions/[versionId]/default`
- `api/v1/models/[modelId]/versions/[versionId]/deprecate`
- `api/v1/models/[modelId]/versions/[versionId]/deprecation`
- `api/v1/models/[modelId]/versions/[versionId]/effective-availability`
- `api/v1/models/[modelId]/versions/[versionId]/effective-capabilities`
- `api/v1/models/[modelId]/versions/[versionId]/effective-deprecation`
- `api/v1/models/[modelId]/versions/[versionId]/release-channel`
- `api/v1/models/[modelId]/versions/[versionId]/retire`
- `api/v1/models/[modelId]/versions/[versionId]/rollback`
- `api/v1/models/availability-search`
- `api/v1/models/capability-compatibility`
- `api/v1/models/capability-search`
- `api/v1/models/lifecycle/risks`
- `api/v1/models/migration/approve`
- `api/v1/models/migration/simulate`
- `api/v1/pricing`
- `api/v1/provider-sync/conflict-summary`
- `api/v1/provider-sync/conflicts`
- `api/v1/provider-sync/conflicts/[conflictId]`
- `api/v1/provider-sync/conflicts/[conflictId]/resolve`
- `api/v1/provider-sync/conflicts/bulk-resolve`
- `api/v1/provider-sync/failed`
- `api/v1/provider-sync/jobs`
- `api/v1/provider-sync/jobs/[jobId]`
- `api/v1/provider-sync/jobs/[jobId]/approve`
- `api/v1/provider-sync/jobs/[jobId]/cancel`
- `api/v1/provider-sync/jobs/[jobId]/execute`
- `api/v1/provider-sync/jobs/[jobId]/history`
- `api/v1/provider-sync/jobs/[jobId]/operations`
- `api/v1/provider-sync/jobs/[jobId]/plan`
- `api/v1/provider-sync/jobs/[jobId]/preview`
- `api/v1/provider-sync/jobs/[jobId]/progress`
- `api/v1/provider-sync/jobs/[jobId]/resume`
- `api/v1/provider-sync/jobs/[jobId]/retry`
- `api/v1/provider-sync/jobs/[jobId]/rollback`
- … +19 more

### public_pages (5)

- `cookies`
- `imprint`
- `index`
- `privacy`
- `terms`

### static_generated (2)

- `_not-found`
- `favicon.ico`

### webhooks (1)

- `api/webhooks/stripe`
