# Phase 4 Playwright Validation Report

- **Preview URL:** https://zwima-f21rv0w6b-zwima.vercel.app
- **Deployment ID:** dpl_EyuYHgFr8vd3RXiodpgZLkeXQavQ
- **Clerk auth valid:** NO
- **Timestamp:** 2026-07-14T20:02:45.874Z
- **READY FOR PHASE 4 RC:** NO

## Workspace pages

## Feature results
- Project CRUD: **SKIP**
- API Keys: **SKIP**
- Usage/CSV: **SKIP**
- Billing guard: **SKIP**
- Logs security: **SKIP**
- Settings/Audit: **SKIP**
- Admin regression: **SKIP**
- Org isolation: **SKIP**

## Routing modes

## Skipped
- Admin page /dashboard/admin: redirected to /dashboard (non-admin user)
- Admin page /dashboard/admin/providers: redirected to /dashboard (non-admin user)
- Admin page /dashboard/admin/models: redirected to /dashboard (non-admin user)
- Admin page /dashboard/admin/routing: redirected to /dashboard (non-admin user)
- Admin page /dashboard/admin/compliance: redirected to /dashboard (non-admin user)
- Admin regression: skipped for non-admin Google account
- Admin API /api/admin/routing/overview not deployed on current Preview

## Console errors (sample)
- none

## Network 4xx/5xx (sample)
- none

## P0
- Clerk auth invalid or expired — run npm run e2e:auth

## P1
- 7 skipped check(s)