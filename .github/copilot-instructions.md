## Quick Orientation for AI Coding Agents

This repo is a TypeScript Express backend + Next.js frontend for a karate-school attendance system. Be concise and precise: prefer minimal, focused code changes that follow existing layers and conventions.

### Big picture
- **Backend**: TypeScript + Express in `src/` following clean architecture (controllers → services → models). Example: [src/controllers/AttendanceController.ts](../src/controllers/AttendanceController.ts) calls [src/services/AttendanceService.ts](../src/services/AttendanceService.ts) which operates on Mongoose models.
- **Frontend**: Next.js 16 App Router in `frontend/src/app` with NextAuth session management. Key API wrapper: [frontend/src/lib/api.ts](../frontend/src/lib/api.ts).
- **Config**: YAML-driven domain config ([config/system.yaml](../config/system.yaml)) manages categories and belt levels; loaded via [src/services/ConfigService.ts](../src/services/ConfigService.ts) singleton.

### Project conventions and patterns
- **Layering**: Controllers handle HTTP only; all business logic lives in Services; Models define schema + validation. Never put logic in controllers.
- **Type safety**: Enums + interfaces defined in [src/types/interfaces.ts](../src/types/interfaces.ts) (e.g., `UserRoleEnum`, `AttendanceStatusEnum`). Use Mongoose type guards in services for populating references.
- **Validation**: Joi schemas in middleware ([src/middleware/validation.ts](../src/middleware/validation.ts)); Mongoose schema validators as secondary layer.
- **Error handling**: Global error handler ([src/middleware/errorHandler.ts](../src/middleware/errorHandler.ts)) transforms Mongoose errors (CastError, ValidationError, duplicate key, JWT errors) to HTTP responses.
- **Auth**: JWT-based with refresh tokens ([src/utils/jwt.ts](../src/utils/jwt.ts)); auth middleware enforces role + status checks, updates last_login. Frontend uses `fetchWithAuth()` helper with token from NextAuth session.
- **Path alias**: `@/*` → `src/*` in backend; use in imports where present.
- **Tests**: Jest with in-memory MongoDB ([src/test/setup.ts](../src/test/setup.ts)); test shape mirrors src/ structure.

### Developer workflows / commands
- **Package manager**: `pnpm` (lockfile present). Install with `pnpm install` at root, then `cd frontend && pnpm install`.
- **Dev servers**: `./scripts/start-dev.sh` boots backend (port 4000) + frontend (port 4001). Or run separately: `pnpm run dev` (backend) and `cd frontend && pnpm run dev` (frontend).
- **Seed admin**: `pnpm run seed:admin` creates admin@karateattendance.com / ChangeMe123!
- **Production locally**: `./scripts/start-prod.sh` builds and runs on ports 4010/4011, logs to `logs/`, PIDs to `.prod_*.pid`.
- **Tests**: `pnpm test` from root. Coverage thresholds in `jest.config.js`.

### Integration points & external deps
- **MongoDB**: Docker via `docker-compose.yml` (port 27019 → container 27017); connection string in `.env`.
- **ConfigService**: Singleton initialized at app startup; validates YAML structure; used in validators and controllers. Changes to `system.yaml` require restart.
- **Multiple categories**: Students + Classes support arrays of categories (e.g., student in "kids" AND "advanced"); Attendance tracked per category per session.
- **Authentication**: Backend issues JWT + refresh token; frontend stores in NextAuth session; both required for full workflow.

### Common patterns & how to extend
- **Adding an endpoint**: Create in route file → controller → service → model (in reverse for deletes). Update Joi validation schema.
- **Category/belt validation**: Don't hardcode; import from ConfigService and iterate `getCategories()` / `getBeltLevels()`.
- **Service method with population**: Always use `.populate<{ field: TypeName }>('field')` syntax for type safety. Example: `.populate<{ class_id: IClassInfo }>('class_id')` (see AttendanceService for pattern). This gives TypeScript proper inference for populated fields.
- **Role-based routes**: Use `authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR)` middleware on route.
- **Error in service**: Throw error with descriptive message; errorHandler middleware catches and returns HTTP response.

### What to look for when editing code
- Keep service method signatures stable — changing requires updating controller + corresponding tests.
- When modifying attendance logic, recall: attendance = student + class_schedule + date + status + category + recorded_by.
- Always verify ConfigService is initialized before validators run (see auth middleware for example).
- Tests depend on in-memory DB + ConfigService initialization; review setup.ts if adding new service methods.

### Useful files to inspect first
- [README.md](../README.md) — full quick start, port sync, API endpoints
- [CLAUDE.md](../CLAUDE.md) — development commands + architecture recap
- [config/system.yaml](../config/system.yaml) — categories + belt levels source
- [src/types/interfaces.ts](../src/types/interfaces.ts) — all enums + DTOs
- [src/services](../src/services) — ConfigService (singleton) + AttendanceService (business logic)
- [src/middleware/auth.ts](../src/middleware/auth.ts) — JWT flow + role enforcement
