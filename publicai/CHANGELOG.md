# Changelog

## Sprint 41 — Production Operations & Legal Readiness (2026-07-07)

### Added
- Production SMTP via nodemailer (IONOS) with automatic mock fallback
- Email templates: billingReceipt, apiKeyCreated, contactMessage
- Contact API (`POST /api/contact`) with honeypot and rate limiting
- Legal pages: API Terms, Rate Limit Policy, Refund Policy
- KNOWN_LIMITATIONS.md, ROADMAP.md
- `scripts/verify-sprint41-ops.mjs`

### Changed
- Contact form submits via API with mailto fallback
- Billing sends billing receipt email on plan upgrade
- API key creation sends notification email
- Documentation: Python/Node SDK examples, pricing, credits, models

## Sprint 40 Final — Launch Readiness (2026-07-07)

### Added
- Public beta bar, feedback button, and waitlist placeholder
- Provider status labels: Claude (Waiting API Key), DeepSeek (Waiting Balance / API Key), Mistral/OpenRouter (Coming Soon)
- Email logs API (`/api/email/logs`), IONOS SMTP placeholder, dev mock mode
- Legal pages: Cookie Policy, DPA placeholder, GDPR export placeholder, Delete account placeholder
- Release documentation: CHANGELOG, RELEASE_NOTES, PROJECT_ROADMAP, TODO, LAUNCH_CHECKLIST
- `scripts/verify-sprint40-final.mjs` and expanded release gate

### Changed
- Landing page, pricing, footer links, and FAQ aligned for public beta launch
- Privacy policy updated for auth, billing, and cookies
- Documentation: Getting Started and API Keys sections

### Fixed
- Supabase client service syntax errors (`async refreshFromDb` shorthand)
- Admin Provider Status regression label
- Gemini quota handling in live verify scripts

## Sprint 40 — Public Launch Commercial Beta

- Commercial landing page, model cards, provider status page
- Onboarding flow (7 steps), transactional email module
- 404/500 error pages, commercial polish CSS

## Sprint 39 — Enterprise Workspace

- Organizations, teams, roles, workspace sharing

## Sprint 38 — Commercial Subscription System

- Subscription plans, credit packages, billing, commerce admin

## Sprint 37 — Provider Independent Gateway

- Universal router, provider registry, gateway health API
