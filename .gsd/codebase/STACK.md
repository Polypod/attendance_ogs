# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- TypeScript 5.9.x — Both backend (`src/`) and frontend (`frontend/src/`)
- JavaScript (config) — `jest.config.js`, `ecosystem.config.js`

**Secondary:**
- YAML — Domain configuration (`config/system.yaml`)
- HTML/CSS — Tailwind utility classes via `frontend/`

## Runtime

**Environment:**
- Node.js (LTS) — Backend Express server and Next.js frontend

**Package Manager:**
- pnpm — Lockfile present at both `pnpm-lock.yaml` and `frontend/pnpm-lock.yaml`

## Frameworks

**Backend:**
- Express 5.2.x — REST API server (`src/index.ts`)
- Mongoose 9.1.x — MongoDB ODM, schemas in `src/models/`

**Frontend:**
- Next.js 16.1.1 — App Router in `frontend/src/app/`
- React 19.2.x — UI layer

**Auth (Frontend):**
- NextAuth 4.24.x — Session management, Credentials provider (`frontend/src/app/api/auth/[...nextauth]/route.ts`)

**UI Components:**
- Radix UI — Headless primitives (`@radix-ui/react-avatar`, `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-checkbox`, `@radix-ui/react-tabs`, `@radix-ui/react-slot`)
- Tailwind CSS 4.x — Utility classes (`frontend/`)
- Lucide React 0.562.x — Icons
- shadcn/ui conventions — Component structure in `frontend/src/components/ui/`

**Scheduling (Frontend):**
- FullCalendar 6.x — Calendar views (`@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`) — declared in root `package.json`

**Testing:**
- Jest 30.x — Test runner (`jest.config.js`)
- ts-jest 29.x — TypeScript transformation for Jest
- mongodb-memory-server 11.x — In-memory MongoDB for tests (`src/test/setup.ts`)

**Build/Dev:**
- ts-node-dev 2.x — Hot-reload dev server for backend
- ts-node + tsconfig-paths — Scripts (`seed:admin`)
- PM2 — Process manager for production (`ecosystem.config.js`)
- Apache httpd — Reverse proxy for production (`apache-att.minamail.se.conf`)
- Docker Compose — MongoDB container (`docker-compose.yml`)

## Key Dependencies

**Security:**
- `helmet` 8.x — HTTP security headers on Express (`src/middleware/middleware.ts`)
- `cors` 2.x — CORS restricted to `FRONTEND_URL` env var
- `express-rate-limit` 8.x — Auth (5 req/15 min) and API (100 req/15 min) rate limits (`src/middleware/rateLimiter.ts`)
- `bcryptjs` 3.x — Password hashing (`BCRYPT_ROUNDS` env var, default 10)
- `jsonwebtoken` 9.x — JWT access + refresh tokens (`src/utils/jwt.ts`)

**Data/Validation:**
- `mongoose` 9.x — MongoDB ODM with schema validation
- `joi` 18.x — Request body validation (`src/middleware/validation.ts`)
- `js-yaml` 4.x — Loads `config/system.yaml` at startup via `ConfigService`
- `moment` 2.x — Date/time manipulation for class scheduling logic

**Utility:**
- `dotenv` 17.x — Loads `.env` at startup
- `class-variance-authority`, `clsx`, `tailwind-merge` — Tailwind class utilities (frontend)

## Configuration

**Backend environment (`/.env`, template at `/.env.example`):**
- `MONGODB_URI` — MongoDB connection string
- `PORT` — Server port (dev: 4000, prod: 4010)
- `NODE_ENV` — `development` | `production`
- `FRONTEND_URL` — CORS allow-origin
- `JWT_SECRET`, `JWT_EXPIRES_IN` — Access token config
- `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` — Refresh token config
- `BCRYPT_ROUNDS` — bcrypt cost factor

**Frontend environment (`frontend/.env.local`):**
- `BACKEND_URL` — Server-side fetch target (e.g., `http://localhost:4010`)
- `NEXT_PUBLIC_API_URL` — Client-side API URL (empty = use relative proxy)
- `NEXTAUTH_URL` — NextAuth canonical URL (prod: `https://att.minamail.se`)
- `NEXTAUTH_SECRET` — NextAuth session signing secret

**Domain config (`config/system.yaml`):**
- Categories: `kids`, `youth`, `adult`, `advanced`
- Belt levels: 10kyu → 1dan (Goju-ryu karate ranking)
- Loaded once at startup by singleton `ConfigService`; changes require restart

**Build:**
- Backend: `tsconfig.json` — target ES2020, module Node16, outDir `dist/`, path alias `@/*` → `src/*`
- Frontend: `frontend/tsconfig.json` — target ES2017, module esnext/bundler, path alias `@/*` → `./src/*`
- ESLint: `eslint.config.mjs` (backend), `frontend/eslint.config.mjs` (frontend)

## Platform Requirements

**Development:**
- Docker (for MongoDB via `docker-compose.yml`, port 27019)
- Node.js + pnpm
- Dev servers: backend port 4000, frontend port 4001

**Production:**
- Linux server with PM2 + Apache httpd
- Let's Encrypt SSL (`/etc/webmin/letsencrypt-*.pem`)
- Backend port 4010, frontend port 4011
- Domain: `att.minamail.se`
- PM2 auto-restart, 500 MB memory cap per process, logs to `logs/`

---

*Stack analysis: 2026-04-13*
