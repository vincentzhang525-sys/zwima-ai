# ZWIMA AI — Sprint 41 Release Notes

**Production URL:** https://zwima-group.info  
**Status:** Public Beta — Operations & Legal Ready

## Operations

- **SMTP:** IONOS-ready via nodemailer (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- **Fallback:** `EMAIL_PROVIDER=mock` or missing SMTP config → mock mode (production safe)
- **Email templates:** welcome, password reset, billing receipt, credit purchase, API key created
- **Contact:** API form with validation, honeypot, rate limits, mailto fallback

## Legal (complete set)

Impressum, Privacy, Cookie Policy, Terms, DPA, GDPR Export, Delete Account, API Terms, Rate Limit Policy, Refund Policy

## Documentation

Getting Started, API reference, Python/Node examples, rate limits, pricing, credits, models

## Support

hello@zwima-group.info

---

# ZWIMA AI — Sprint 40 Final Release Notes

**Production URL:** https://zwima-group.info  
**Status:** Public Beta — Launch Ready

## What's New

ZWIMA AI is ready for external beta customers with a complete commercial SaaS flow:

- **Live providers:** OpenAI, Google Gemini
- **Unified API gateway** with credits, billing, and usage monitoring
- **Customer onboarding** from registration through first API call
- **Enterprise workspace** (organizations, teams, roles)
- **Public status page** with provider health and availability labels

## Provider Availability

| Provider | Status |
|----------|--------|
| OpenAI | Live |
| Google Gemini | Live |
| Claude | Waiting API Key |
| DeepSeek | Waiting Balance / API Key |
| Qwen | Waiting API Key |
| Mistral | Coming Soon |
| OpenRouter | Coming Soon |

## Email

Transactional email templates are ready (welcome, verify, password reset, billing). Production uses mock mode until SMTP is configured. Mass sending is disabled.

## Legal

Impressum, Privacy Policy, Terms, Cookie Policy, and GDPR placeholders are published. Enterprise DPA available on request.

## Getting Started

1. Sign up at https://zwima-group.info/signup.html
2. Create an API key in the dashboard
3. Test in Playground or call `POST /api/gateway/chat`
4. View usage and billing in the dashboard

## Support

Email: hello@zwima-group.info
