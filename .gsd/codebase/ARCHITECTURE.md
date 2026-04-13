# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Monorepo with clean-architecture Express backend + Next.js App Router frontend

**Key Characteristics:**
- Backend follows strict layered architecture: Routes → Controllers → Services → Models
- Frontend uses Next.js 14 App Router with NextAuth session management
- Business logic is fully isolated in Services; Controllers handle HTTP only
- Config-driven domain data (categories, belt levels) loaded via Singleton at startup
- JWT-based auth with refresh tokens; frontend proxies auth through NextAuth

## Layers

**Routes:**
- Purpose: Declare HTTP endpoints, bind middleware and controllers
- Location: `src/routes/`
- Contains: Express Router definitions, route-level authorization, Joi validation wiring
- Depends on: Controllers, auth middleware, validation middleware
- Used by: `src/index.ts` entry point

**Controllers:**
- Purpose: HTTP request/response handling only — no business logic
- Location: `src/controllers/`
- Contains: Request extraction, calls to service methods, response formatting
- Depends on: Services, DTOs from `src/types/interfaces.ts`
- Used by: Routes

**Services:**
- Purpose: All business logic
- Location: `src/services/`
- Contains: `AttendanceService` (complex scheduling/attendance logic), `ConfigService` (singleton YAML config)
- Depends on: Mongoose Models, `moment`, ConfigService
- Used by: Controllers

**Models:**
- Purpose: Mongoose schema definitions, validators, document interfaces
- Location: `src/models/`
- Contains: `Attendance`, `Class`, `ClassSchedule`, `Student`, `User`
- Depends on: `src/types/interfaces.ts` (enums), ConfigService (category/belt validation)
- Used by: Services

**Middleware:**
- Purpose: Cross-cutting concerns — auth, validation, error handling, rate limiting
- Location: `src/middleware/`
- Contains: `auth.ts` (JWT authenticate + authorize), `errorHandler.ts`, `middleware.ts` (helmet/cors/json), `validation.ts` (Joi wrapper), `rateLimiter.ts`
- Depends on: `src/utils/jwt.ts`, Mongoose models
- Used by: `src/index.ts` (global), Routes (per-route)

**Types:**
- Purpose: TypeScript interfaces, enums, DTOs shared across the backend
- Location: `src/types/interfaces.ts`, `src/types/config.ts`, `src/types/validation.ts`
- Contains: All enums (`UserRoleEnum`, `AttendanceStatusEnum`, etc.), domain interfaces (`Student`, `Class`, `Attendance`), DTOs (`MarkAttendanceDto`)
- Depends on: Nothing
- Used by: All layers

**Frontend:**
- Purpose: Next.js 14 App Router UI
- Location: `frontend/src/`
- Contains: App pages under `app/`, shadcn/ui components under `components/ui/`, custom hooks under `hooks/`, API wrapper at `lib/api.ts`
- Depends on: NextAuth, backend REST API via `fetchWithAuth()`
- Used by: End users

## Data Flow

**HTTP Request (Backend):**

1. Request arrives at `src/index.ts`
2. Global middleware applied (helmet, cors, json body parser)
3. Route matched — authentication middleware runs if route is protected
4. Authorization middleware checks `req.user.role` against allowed roles
5. Joi validation middleware validates `req.body`
6. Controller method invoked — extracts params, calls Service
7. Service executes business logic against Mongoose models
8. Controller sends `{ success: true, data: ... }` JSON response
9. On error: thrown error propagates to `errorHandler` middleware

**Frontend Auth Flow:**

1. User submits credentials on `/login`
2. NextAuth `CredentialsProvider` calls `POST /api/auth/login` on backend
3. Backend returns `{ user, token, refreshToken }`
4. NextAuth stores tokens in JWT session cookie
5. Client pages use `useSession()` to get `accessToken`
6. `fetchWithAuth()` or `createApiClient()` adds `Authorization: Bearer <token>` header
7. 401 responses trigger redirect to `/login`

**Frontend Route Protection:**

1. `frontend/src/proxy.ts` (Next.js middleware) intercepts all `/dashboard/*` requests
2. NextAuth `withAuth` checks session token presence
3. Unauthenticated requests redirect to `/login`

**Config Initialization:**

1. App boot: `ConfigService.initialize()` reads `config/system.yaml`
2. Validates category and belt level structure
3. Singleton stored via `ConfigService.getInstance()`
4. Mongoose validators in Models call `ConfigService.getInstance().isValidCategory()` at save time

## Key Abstractions

**ConfigService (Singleton):**
- Purpose: Runtime domain configuration for categories and belt levels
- File: `src/services/ConfigService.ts`
- Pattern: Singleton with async `initialize()` called before server starts; consumers call `getInstance()`

**authenticate / authorize middleware:**
- Purpose: JWT verification and role-based access control
- Files: `src/middleware/auth.ts`
- Pattern: `authenticate` attaches `req.user`; `authorize(...roles)` is a factory that returns middleware checking `req.user.role`

**errorHandler:**
- Purpose: Unified error → HTTP response transformation
- File: `src/middleware/errorHandler.ts`
- Pattern: Express 4-arg error middleware; maps Mongoose `CastError`, `ValidationError`, duplicate key 11000, `JsonWebTokenError`, `TokenExpiredError` to HTTP codes

**fetchWithAuth / createApiClient:**
- Purpose: Frontend HTTP client with automatic Bearer token injection
- File: `frontend/src/lib/api.ts`
- Pattern: Wraps `fetch`; reads token from NextAuth session; redirects to `/login` on 401

**populate type safety pattern:**
- Purpose: Type-safe Mongoose document population
- Files: `src/services/AttendanceService.ts`
- Pattern: `.populate<{ class_id: IClassInfo }>('class_id')` with a local interface that `Omit`s the ref field

## Entry Points

**Backend Server:**
- Location: `src/index.ts`
- Triggers: `node dist/index.js` (production), `ts-node-dev src/index.ts` (development)
- Responsibilities: Express app setup, middleware registration, route mounting, MongoDB connection, ConfigService initialization, graceful shutdown

**Frontend App:**
- Location: `frontend/src/app/layout.tsx`
- Triggers: Next.js dev server or `next start`
- Responsibilities: Root layout, `Providers` wrapper (NextAuth `SessionProvider`), global CSS

**Frontend Route Guard:**
- Location: `frontend/src/proxy.ts` (Next.js middleware file)
- Triggers: Every request matching `/dashboard/*`
- Responsibilities: Redirect unauthenticated users to `/login`

**Admin Seed Script:**
- Location: `src/scripts/seedAdmin.ts`
- Triggers: `pnpm run seed:admin`
- Responsibilities: Creates default admin user

## Error Handling

**Strategy:** Throw-and-catch at service layer; global Express error middleware normalizes all errors to JSON

**Patterns:**
- Services throw plain `Error` with descriptive messages
- Controllers do not catch errors — they propagate to `errorHandler`
- `errorHandler` maps Mongoose/JWT error types to appropriate HTTP status codes
- 404 responses sent inline in `src/index.ts` catch-all handler
- Frontend `fetchWithAuth()` throws on non-2xx; 401 triggers immediate redirect

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` with ISO timestamps; no structured logging library
**Validation:** Two-layer — Joi schemas in route middleware (request boundary), Mongoose validators in models (DB boundary)
**Authentication:** JWT access token (24h) + refresh token (7d); stored in NextAuth session; enforced via `authenticate` middleware on all protected routes
**Security headers:** `helmet` applied globally in `src/middleware/middleware.ts`
**CORS:** Configured for single frontend origin from `FRONTEND_URL` env var
**Rate limiting:** `express-rate-limit` via `src/middleware/rateLimiter.ts`

---

*Architecture analysis: 2026-04-13*
