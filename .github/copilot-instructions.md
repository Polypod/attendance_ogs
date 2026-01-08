## Quick Orientation for AI Coding Agents

This repo is a TypeScript Express backend + Next.js frontend for a karate-school attendance system. Be concise and precise: prefer minimal, focused code changes that follow existing layers and conventions.

### Big picture
- Backend: TypeScript + Express in `src/` (controllers → services → models). Example: [src/controllers/AttendanceController.ts](../src/controllers/AttendanceController.ts) uses services in `src/services/` which operate on Mongoose models in `src/models/`.
- Frontend: Next.js 16 App Router in `frontend/src/app` with NextAuth. Key API wrapper: `frontend/src/lib/api.ts`.
- Config: YAML-driven domain config in `config/system.yaml` (categories, belt levels).

### Project conventions and patterns
- Layering: Controllers handle HTTP, call Services for business logic, Services call Models/DB. Avoid putting business logic in controllers.
- Validation: Request validation uses Joi in middleware; look at `src/middleware/validation.ts` for examples.
- Auth: JWT-based; server-side checks live in `src/middleware/auth.ts`. Frontend uses NextAuth and `fetchWithAuth` in `frontend/src/lib/api.ts`.
- Path alias: `@/*` → `src/*` per `tsconfig.json` — use it in backend code where present.
- Tests: Jest config at `jest.config.js`; test setup in `src/test/setup.ts`. Use in-memory MongoDB for unit tests.

### Developer workflows / commands
- Package manager: `pnpm` (lockfile present). Run `pnpm install` at repo root, then `cd frontend && pnpm install` for frontend deps.
- Dev servers: `./scripts/start-dev.sh` (root) boots backend + frontend for local development. Alternatively run backend `pnpm run dev` and frontend `cd frontend && pnpm run dev` separately.
- Seed admin: run `pnpm run seed:admin` (see `src/scripts/seedAdmin.ts`).
- Production build & local prod runner: `./scripts/start-prod.sh` builds and starts backend+frontend (writes PIDs to `.prod_*.pid` and logs to `logs/`).

### Integration points & external deps
- MongoDB: configured via `docker-compose.yml` and `config/system.yaml`; README documents Docker port mapping and connection strings.
- Authentication: backend issues JWTs (`src/utils/jwt.ts`); frontend stores session with NextAuth (see `frontend/src/app/api/auth/[...nextauth]`).
- Calendar & UI: frontend uses FullCalendar and shadcn/ui components — follow existing UI patterns in `frontend/src/components`.

### What to look for when editing code
- Keep service APIs stable: change service signatures only when corresponding controller and tests are updated.
- When adding endpoints, update `src/routes/*` and corresponding controller + service + route tests.
- For frontend changes respecting role-based UI: use `useAuth()` (see `frontend/src/hooks/useAuth.ts`) and the `DashboardLayout` role filters.

### Tests & CI expectations
- Unit tests use Jest. Run `pnpm test` from repo root. Keep coverage thresholds in `jest.config.js` in mind if modifying behavior.

### Useful files to inspect first
- [README.md](../README.md) — project-level quick start and port conventions
- [CLAUDE.md](../CLAUDE.md) — condensed backend notes and developer commands
- [config/system.yaml](../config/system.yaml) — app configuration source
- [src/controllers](../src/controllers) and [src/services](../src/services) — main backend logic flow
- [frontend/src/app](../frontend/src/app) and [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — frontend data flow and auth wrapper

If anything is unclear or a behavior is undocumented, ask a concise question and include file references and a short code snippet proposal to change. After drafting a patch, run existing tests (`pnpm test`) and try the dev script (`./scripts/start-dev.sh`) locally.

---
If you'd like, I can refine this file to add more file-level examples or checklist items for common PRs (auth fixes, schedule logic, attendance edge-cases).
