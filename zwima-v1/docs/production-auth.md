# Production Authentication — ZWIMA AI

**Status:** Verified working (2026-07-17)  
**Do not change** items listed under “Frozen / Do Not Touch” without an explicit production incident.

---

## Production domain

| Item | Value |
|------|--------|
| App URL | `https://zwima-group.info` |
| Login | `https://zwima-group.info/login` |
| Signup | `https://zwima-group.info/signup` |
| Dashboard | `https://zwima-group.info/dashboard` |
| Clerk FAPI proxy | `https://zwima-group.info/__clerk` |

---

## Clerk Production instance

- Environment: **Production** (not Development)
- Keys: `pk_live_…` / `sk_live_…` (values live only in Vercel — never commit)
- Frontend API is served via **app-domain proxy** (not the unresolved host `clerk.zwima-group.info`)

### Why `/__clerk` (double underscore)

Clerk’s Next.js Frontend API proxy path is **`/__clerk`**.  
A single underscore `/_clerk` is **wrong** and will break OAuth callbacks.

Verified Google OAuth `redirect_uri` (actual request capture):

```text
https://zwima-group.info/__clerk/v1/oauth_callback
```

---

## Vercel Production environment variable **names**

Auth-related (names only):

| Variable |
|----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| `CLERK_SECRET_KEY` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` |
| `NEXT_PUBLIC_CLERK_PROXY_URL` |
| `NEXT_PUBLIC_APP_URL` |
| `CLERK_WEBHOOK_SECRET` (optional) |

Expected path values:

| Variable | Expected value |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/signup` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_PROXY_URL` | `https://zwima-group.info/__clerk` |
| `NEXT_PUBLIC_APP_URL` | `https://zwima-group.info` |

---

## Google OAuth Client (structure only)

| Setting | Correct value |
|---------|----------------|
| Application type | Web application |
| JavaScript origin | `https://zwima-group.info` |
| Authorized redirect URI | `https://zwima-group.info/__clerk/v1/oauth_callback` |

Client must match the **exact** OAuth client ID configured in Clerk Production Google SSO (do not paste credentials into this doc).

---

## App wiring (reference)

| File | Role |
|------|------|
| `src/middleware.ts` | `clerkMiddleware` + `frontendApiProxy.enabled` + matcher `/__clerk/(.*)` |
| `src/app/layout.tsx` | `ClerkProvider` with `proxyUrl` from `NEXT_PUBLIC_CLERK_PROXY_URL` |
| `src/app/login/page.tsx` | Google + email sign-in |
| `src/app/signup/page.tsx` | Registration |

---

## Common `redirect_uri_mismatch` checklist

1. Capture the **live** authorize URL to `accounts.google.com/o/oauth2/auth` and read `redirect_uri` (do not guess).
2. Confirm path is **`/__clerk/v1/oauth_callback`** (double underscore).
3. Confirm URI is saved on the **same** Google Cloud OAuth client that Clerk Production uses.
4. Confirm JavaScript origin is exactly `https://zwima-group.info` (no trailing slash).
5. Remove wrong URIs if present:
   - `/_clerk/...` (single underscore)
   - `https://clerk.zwima-group.info/v1/oauth_callback`
   - `www.` variants (unless you actually serve www)
6. Wait 1–5 minutes after saving Google Console changes, then retry.

---

## Frozen / Do Not Touch

Unless there is an explicit production auth incident, **do not change**:

- Google Redirect URI
- Google Client ID / Client Secret
- Clerk Production publishable / secret keys
- `NEXT_PUBLIC_CLERK_PROXY_URL` or `/__clerk` proxy path
- Clerk Production ↔ Google SSO binding
- Working login / SSO callback routes

---

## Verified production user (reference)

- Email (non-secret): `vincentzhang525@gmail.com`
- Login method: Google OAuth via Clerk Production
- First successful production auth: 2026-07-17
