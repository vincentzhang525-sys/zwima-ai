# ZWIMA AI V1 — Phase 2

Commercial AI API Distribution Platform built with Next.js 15, React 19, TypeScript, TailwindCSS, Prisma, PostgreSQL, Stripe, Resend, and Clerk Auth.

## Quick start

```bash
cd zwima-v1
cp .env.example .env.local
# Fill in DATABASE_URL, Clerk, Stripe, Resend keys
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 2 scope

- Landing page (`/`) — Hero, Features, Pricing, Providers, FAQ, Footer
- Auth — `/signup`, `/login` (Clerk + Resend verification email)
- Dashboard — balance, usage, billing, API keys, settings
- Stripe Checkout — credit recharge with webhook fulfillment
- Provider router — unified interface (stub implementations; live integration in Phase 3)
- Prisma models — Users, ApiKeys, Providers, Transactions, Payments, UsageLogs, CreditBalance

## Deploy (Vercel)

Set root directory to `zwima-v1`, add env vars from `.env.example`, and connect a PostgreSQL database (Neon/Supabase/Vercel Postgres).

## Phase 3 — Provider Integration

- Real adapters: OpenAI, Gemini, DeepSeek, Qwen, Claude
- Unified router — no hardcoded provider routing in business layer
- Credits engine with margin multiplier
- `GET /api/v1/models`, `GET /api/v1/health`, `POST /api/v1/chat`
- Admin providers dashboard at `/dashboard/providers`

## Next phase

Enterprise Token Billing Engine (Phase 4)
