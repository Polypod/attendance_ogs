# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**None detected** — No third-party SaaS APIs (Stripe, Twilio, SendGrid, etc.) are integrated. The system is self-contained.

## Data Storage

**Databases:**
- MongoDB (self-hosted via Docker)
  - Image: `mongo:latest` (`docker-compose.yml`)
  - Container name: `attendance-mongodb`
  - Host port: `27019` → Container port `27017`
  - Database name: `attendance`
  - Connection env var: `MONGODB_URI`
  - Client/ODM: Mongoose 9.x (`src/models/`)
  - Auth: `root` / `ogsadmin` (local dev); change in production
  - Volume: `mongodb_data` (named Docker volume, persistent)

**File Storage:**
- Local filesystem only — `config/system.yaml` for domain configuration, `logs/` for PM2 log output

**Caching:**
- None — No Redis or other cache layer; rate-limit state uses in-process `MemoryStore` from `express-rate-limit`

## Authentication & Identity

**Backend:**
- Custom JWT implementation (`src/utils/jwt.ts`)
  - Library: `jsonwebtoken` 9.x
  - Access token: signed with `JWT_SECRET`, expiry via `JWT_EXPIRES_IN` (default `24h`)
  - Refresh token: signed with `JWT_REFRESH_SECRET`, expiry via `JWT_REFRESH_EXPIRES_IN` (default `7d`)
  - Enforcement: `authenticate` middleware in `src/middleware/auth.ts` — validates Bearer token, checks user existence and active status, detects post-issue password changes
  - Role enforcement: `authorize(...roles)` middleware enforces `UserRoleEnum` (ADMIN, INSTRUCTOR, etc.)

**Frontend:**
- NextAuth v4 with **Credentials provider** (`frontend/src/app/api/auth/[...nextauth]/route.ts`)
  - Session strategy: `jwt`, maxAge 24h
  - On sign-in: calls backend `POST /api/auth/login`, stores `accessToken` + `refreshToken` in NextAuth session
  - Session passed to client components via `useSession()` / `getSession()`
  - Route protection: `frontend/src/proxy.ts` uses `withAuth` middleware matcher on `/dashboard/*`
  - API calls use `fetchWithAuth()` in `frontend/src/lib/api.ts` — injects `Authorization: Bearer <token>` header

**Password Hashing:**
- `bcryptjs` 3.x — cost factor from `BCRYPT_ROUNDS` env var (default `10`)

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, Datadog, or similar service integrated

**Logs:**
- Backend: `console.log` per request in `src/index.ts`; PM2 captures stdout/stderr to `logs/backend-prod.log` and `logs/backend-prod-error.log`
- Frontend: PM2 captures to `logs/frontend-prod.log` and `logs/frontend-prod-error.log`
- Development: inline `console.log` in `frontend/src/lib/api.ts` (only in `NODE_ENV=development`)

## CI/CD & Deployment

**Hosting:**
- Linux server — bare-metal or VM. Domain: `att.minamail.se`

**Process Manager:**
- PM2 — `ecosystem.config.js` defines `backend` and `frontend` apps
  - Auto-restart on crash, max 500 MB memory per process
  - Started at boot via systemd wrapper (`scripts/systemd-pm2-wrapper.sh`)

**Reverse Proxy:**
- Apache httpd — config at `apache-att.minamail.se.conf`
  - HTTP → HTTPS redirect (301)
  - SSL via Let's Encrypt (certbot-managed certs at `/etc/webmin/letsencrypt-*.pem`)
  - HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection headers
  - Routes: `/api/attendance`, `/api/classes`, `/api/schedules`, `/api/students`, `/api/users` → backend port 4010
  - `/api/auth/*` (NextAuth) → frontend port 4011 (NOT proxied to backend)
  - All other traffic → frontend port 4011

**CI Pipeline:**
- None — No GitHub Actions, GitLab CI, or similar configured

## Environment Configuration

**Backend required env vars (see `/.env.example`):**
- `MONGODB_URI` — Full MongoDB connection string with credentials
- `PORT` — Listen port (4000 dev / 4010 prod)
- `NODE_ENV` — `development` | `production`
- `FRONTEND_URL` — Allowed CORS origin
- `JWT_SECRET` — Min 32 chars, access token signing key
- `JWT_EXPIRES_IN` — Access token TTL (e.g., `24h`)
- `JWT_REFRESH_SECRET` — Min 32 chars, refresh token signing key
- `JWT_REFRESH_EXPIRES_IN` — Refresh token TTL (e.g., `7d`)
- `BCRYPT_ROUNDS` — Password hash cost (e.g., `10`)

**Frontend required env vars (`frontend/.env.local` — not in repo):**
- `BACKEND_URL` — Server-side HTTP target for NextAuth credential check (e.g., `http://localhost:4010`)
- `NEXT_PUBLIC_API_URL` — Client-side API base URL; empty string = use relative path (Next.js proxy)
- `NEXTAUTH_URL` — Canonical URL for NextAuth (e.g., `https://att.minamail.se`)
- `NEXTAUTH_SECRET` — Random secret for NextAuth session signing

**Secrets location:**
- Backend: `.env` file at project root (gitignored; template at `.env.example`)
- Frontend: `frontend/.env.local` (gitignored)
- Production secrets also set directly in `ecosystem.config.js` `env` blocks (e.g., `NEXTAUTH_SECRET`)

## Webhooks & Callbacks

**Incoming:**
- None — No webhook endpoints registered

**Outgoing:**
- None — No outgoing HTTP calls to external services beyond the internal backend↔frontend communication

---

*Integration audit: 2026-04-13*
