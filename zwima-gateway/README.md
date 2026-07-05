# Zwima Gateway MVP V0.1

## Quick Start (Docker)

```bash
cd zwima-gateway
docker compose up --build
```

- API: http://localhost:3000
- Admin: http://localhost:3000/admin/ (secret: `dev-admin-secret`)
- Admin user: `admin@zwima.local` / `admin123456`

Set `OPENAI_API_KEY` in `.env` or environment. Without it, `MOCK_OPENAI=true` returns mock responses.

## Local Development

```bash
cp .env.example .env
npm install
docker compose up db -d
npm run db:migrate
npm run db:seed
npm run dev
```

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | — |
| POST | `/auth/login` | — |
| POST | `/api-keys/create` | JWT |
| GET | `/api-keys` | JWT |
| GET | `/account/credits` | JWT |
| POST | `/v1/chat/completions` | Zwima API key |
| GET | `/usage` | JWT |
| GET | `/billing` | JWT |
| GET | `/admin/*` | Admin secret or admin JWT |
