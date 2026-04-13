# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
attendance_ogs/
├── src/                    # Backend TypeScript source
│   ├── index.ts            # Express app entry point
│   ├── controllers/        # HTTP request handlers
│   ├── services/           # Business logic layer
│   ├── models/             # Mongoose schemas + document interfaces
│   ├── routes/             # Express route definitions
│   ├── middleware/         # Auth, validation, error handling, rate limiting
│   ├── types/              # TypeScript interfaces, enums, DTOs
│   ├── utilities/          # Time helpers, domain validators
│   ├── utils/              # JWT helpers
│   ├── scripts/            # One-off scripts (seed admin)
│   ├── test/               # Jest global setup
│   └── __tests__/          # Test files (mirror src/ structure)
├── frontend/               # Next.js 14 frontend
│   └── src/
│       ├── app/            # App Router pages and layouts
│       │   ├── api/        # Next.js API routes (NextAuth)
│       │   ├── dashboard/  # Protected dashboard pages
│       │   └── login/      # Public login page
│       ├── components/
│       │   ├── layouts/    # DashboardLayout shared shell
│       │   └── ui/         # shadcn/ui primitive components
│       ├── hooks/          # React hooks (useAuth, useConfig)
│       ├── lib/            # API wrapper (fetchWithAuth)
│       ├── types/          # Frontend type extensions
│       └── proxy.ts        # Next.js middleware (route guard)
├── config/
│   └── system.yaml         # Domain config: categories, belt levels
├── scripts/                # Shell scripts for dev/prod server startup
├── dist/                   # Compiled TypeScript output (git-ignored)
├── logs/                   # PM2/process logs
├── coverage/               # Jest coverage reports
├── docker-compose.yml      # MongoDB container definition
├── tsconfig.json           # Backend TypeScript config
├── jest.config.js          # Jest config (80% coverage thresholds)
├── package.json            # Backend dependencies
└── ecosystem.config.js     # PM2 process config
```

## Directory Purposes

**`src/controllers/`:**
- Purpose: HTTP layer — extract request data, call services, send responses
- Contains: One class per domain entity, exported as singleton instance
- Key files: `AttendanceController.ts`, `AuthController.ts`, `ScheduleController.ts`, `StudentController.ts`, `ClassController.ts`, `UserController.ts`, `ConfigController.ts`

**`src/services/`:**
- Purpose: All non-trivial business logic
- Contains: `AttendanceService` (complex scheduling, multi-attendance marking, student search), `ConfigService` (YAML singleton)
- Key files: `src/services/AttendanceService.ts` (609 lines — largest file), `src/services/ConfigService.ts`

**`src/models/`:**
- Purpose: Mongoose schema definitions with TypeScript document interfaces
- Contains: One file per MongoDB collection
- Key files: `Attendance.ts`, `Class.ts`, `ClassSchedule.ts`, `Student.ts`, `User.ts`

**`src/routes/`:**
- Purpose: Express Router instances binding paths, middleware, and controllers
- Contains: One file per domain, imported and mounted in `src/index.ts`
- Key files: `attendanceRoutes.ts`, `authRoutes.ts`, `studentRoutes.ts`, `classRoutes.ts`, `scheduleRoutes.ts`, `userRoutes.ts`, `configRoutes.ts`

**`src/middleware/`:**
- Purpose: Reusable Express middleware
- Key files:
  - `auth.ts` — `authenticate` (JWT verify + user attach) and `authorize(...roles)` factory
  - `errorHandler.ts` — Global error → HTTP response transformer
  - `middleware.ts` — `applyMiddleware()` applies helmet, cors, body parsers
  - `validation.ts` — `validateRequest(schema)` Joi wrapper
  - `rateLimiter.ts` — Rate limiting configuration

**`src/types/`:**
- Purpose: Central TypeScript type definitions
- Key files:
  - `interfaces.ts` — All domain enums (`UserRoleEnum`, `AttendanceStatusEnum`, etc.) and interfaces (`Student`, `Class`, `Attendance`, `User`) and DTOs
  - `config.ts` — Config YAML schema types
  - `validation.ts` — Joi schema exports for student/class validation
  - `express.d.ts` — Augments `express.Request` with `user` property

**`src/utilities/`:**
- Purpose: Domain-specific utility functions
- Key files: `timeHelpers.ts`, `validators.ts`

**`src/utils/`:**
- Purpose: Pure utility functions (non-domain)
- Key files: `jwt.ts` — `signToken`, `signRefreshToken`, `verifyToken`, `verifyRefreshToken`

**`config/`:**
- Purpose: Runtime domain configuration
- Key files: `system.yaml` — Defines student categories and belt levels; changes require server restart

**`frontend/src/app/dashboard/`:**
- Purpose: Protected application pages (all require auth)
- Contains:
  - `attendance/[scheduleId]/` — Mark attendance for a specific class session
  - `calendar/` — Schedule calendar view
  - `classes/` — Class management
  - `students/` — Student management
  - `teachers/` — Teacher/instructor views
  - `users/` — User administration (admin only)
  - `debug/` — Development debug page

**`frontend/src/app/api/auth/[...nextauth]/`:**
- Purpose: NextAuth catch-all API route for session management
- Key file: `route.ts` — `CredentialsProvider` that calls backend `POST /api/auth/login`

**`frontend/src/components/ui/`:**
- Purpose: shadcn/ui primitive components (do not modify directly)
- Contains: `button.tsx`, `card.tsx`, `checkbox.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `sheet.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `avatar.tsx`

**`frontend/src/components/layouts/`:**
- Purpose: Shared page shell layouts
- Key file: `DashboardLayout.tsx` — Navigation sidebar + header used by all dashboard pages

## Key File Locations

**Entry Points:**
- `src/index.ts` — Backend Express app bootstrap
- `frontend/src/app/layout.tsx` — Frontend root layout
- `frontend/src/proxy.ts` — Frontend route protection middleware

**Configuration:**
- `config/system.yaml` — Domain data (categories, belt levels)
- `tsconfig.json` — Backend TS config with `@/*` → `src/*` path alias
- `frontend/tsconfig.json` — Frontend TS config with `@/*` → `frontend/src/*` path alias
- `docker-compose.yml` — MongoDB container (port 27019 → 27017)
- `ecosystem.config.js` — PM2 production process config

**Core Logic:**
- `src/services/AttendanceService.ts` — Main business logic (attendance, scheduling)
- `src/services/ConfigService.ts` — Configuration singleton
- `src/types/interfaces.ts` — Canonical type definitions (all enums and domain interfaces)
- `src/middleware/auth.ts` — JWT authentication and role authorization
- `src/middleware/errorHandler.ts` — Global error normalization

**Frontend API Layer:**
- `frontend/src/lib/api.ts` — `fetchWithAuth()` and `createApiClient()` helpers

**Testing:**
- `src/test/setup.ts` — Jest global setup (in-memory MongoDB, ConfigService init)
- `src/__tests__/` — Test files mirroring `src/` structure

## Naming Conventions

**Backend Files:**
- Controllers: `PascalCase` + `Controller` suffix — `AttendanceController.ts`
- Services: `PascalCase` + `Service` suffix — `AttendanceService.ts`
- Models: `PascalCase` noun — `ClassSchedule.ts`
- Routes: `camelCase` + `Routes` suffix — `attendanceRoutes.ts`
- Middleware: `camelCase` noun — `auth.ts`, `errorHandler.ts`
- Types/Interfaces: `IPascalCase` prefix for document interfaces — `IAttendanceDocument`
- Enums: `PascalCase` + `Enum` suffix — `UserRoleEnum`

**Frontend Files:**
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)
- Components: `PascalCase.tsx` — `DashboardLayout.tsx`
- Hooks: `camelCase` with `use` prefix — `useAuth.ts`, `useConfig.ts`

**Routes (API):**
- All grouped under `/api/` prefix
- Resource-plural naming: `/api/students`, `/api/classes`, `/api/schedules`
- Sub-resources: `/api/attendance/student/:studentId`

## Where to Add New Code

**New Backend Feature (full CRUD):**
1. Add interfaces/enums to `src/types/interfaces.ts`
2. Create Mongoose model in `src/models/NewEntity.ts`
3. Create service in `src/services/NewEntityService.ts`
4. Create controller in `src/controllers/NewEntityController.ts`
5. Create routes in `src/routes/newEntityRoutes.ts`
6. Mount routes in `src/index.ts`
7. Add Joi validation schema to `src/types/validation.ts`
8. Add tests in `src/__tests__/` mirroring the above structure

**New Frontend Page:**
- Protected page: `frontend/src/app/dashboard/new-section/page.tsx`
- Public page: `frontend/src/app/new-page/page.tsx`
- Dynamic route: `frontend/src/app/dashboard/entity/[id]/page.tsx`

**New UI Component:**
- Shared layout: `frontend/src/components/layouts/NewLayout.tsx`
- Domain component: `frontend/src/components/NewComponent.tsx`
- Primitive (shadcn): `frontend/src/components/ui/new-primitive.tsx`

**New Custom Hook:**
- Location: `frontend/src/hooks/useNewThing.ts`

**New Utility (Backend):**
- Domain utility: `src/utilities/newHelper.ts`
- Generic utility: `src/utils/newHelper.ts`

## Special Directories

**`dist/`:**
- Purpose: TypeScript compiled output
- Generated: Yes (`pnpm run build`)
- Committed: No (gitignored)

**`coverage/`:**
- Purpose: Jest coverage report
- Generated: Yes (`pnpm test`)
- Committed: No (gitignored)

**`logs/`:**
- Purpose: PM2 process logs for production
- Generated: Yes
- Committed: No (gitignored)

**`frontend/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No (gitignored)

**`.gsd/`:**
- Purpose: GSD planning artifacts (codebase docs, plans, summaries)
- Generated: By GSD agent tools
- Committed: Yes

---

*Structure analysis: 2026-04-13*
