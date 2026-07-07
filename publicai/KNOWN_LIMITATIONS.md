# Known Limitations — ZWIMA AI Public Beta

## Email
- SMTP sends via nodemailer when `EMAIL_PROVIDER=smtp|ionos` and all SMTP_* vars are set
- Falls back to mock mode automatically if SMTP is not configured or send fails
- Mass email disabled

## Providers
- **Live:** OpenAI, Google Gemini
- **Waiting:** Claude (API key), DeepSeek (balance/API key), Qwen (API key)
- **Coming soon:** Mistral, OpenRouter

## Legal
- Impressum requires full legal entity registration details before formal GmbH launch
- DPA, GDPR export, and delete account are placeholder workflows (email support)

## Payments
- Stripe integration in mock mode for beta
- Refund processing is manual via support email

## Operations
- Gemini live verification may skip when Google free-tier quota is exceeded
- No ESLint/Prettier/TypeScript toolchain in repo

## Contact
- Contact form uses API with mailto fallback if API unavailable
- Honeypot + rate limiting for anti-spam
