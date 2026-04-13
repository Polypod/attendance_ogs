# Codebase Concerns

**Analysis Date:** 2026-04-13

## Tech Debt

**Orphaned cascade deletes (TODO comments):**
- Issue: Deleting a Class does not delete its related ClassSchedules; deleting a Schedule does not delete related Attendance records. Both are marked `// TODO` but unimplemented.
- Files: `src/controllers/ClassController.ts:122`, `src/controllers/ScheduleController.ts:389`
- Impact: Orphaned documents accumulate in MongoDB; foreign keys become dangling references; attendance reports produce inconsistent results.
- Fix approach: Add `ClassScheduleModel.deleteMany({ class_id: id })` after class delete; add `AttendanceModel.deleteMany({ class_schedule_id: id })` after schedule delete. Wrap in a transaction or use Mongoose middleware.

**Dynamic `require()` anti-pattern in TypeScript service:**
- Issue: `AttendanceService.ts` uses CommonJS `require()` inside two async methods instead of ES module `import`.
- Files: `src/services/AttendanceService.ts:271`, `src/services/AttendanceService.ts:568`
- Impact: Bypasses TypeScript module resolution; breaks tree-shaking; causes issues with bundlers and test mocking.
- Fix approach: Move `import { validateObjectId } from '../utils/validators';` to the top of the file.

**Pervasive `any` type usage:**
- Issue: 50+ uses of `any` across services, controllers, and models, including `getNextUpcomingClass(): Promise<any | null>` and several `as any` casts in `AttendanceService`.
- Files: `src/services/AttendanceService.ts`, `src/controllers/ScheduleController.ts`, `src/services/ConfigService.ts`, `src/controllers/StudentController.ts`
- Impact: Loss of type safety; errors not caught at compile time; makes refactoring dangerous.
- Fix approach: Define proper interfaces for populated documents and method return types; replace `any` with explicit types.

**Deprecated `moment.js` library:**
- Issue: `moment` is used in 24+ call sites across `AttendanceService.ts` and `timeHelpers.ts`. Moment.js is deprecated by its own maintainers.
- Files: `src/services/AttendanceService.ts`, `src/utilities/timeHelpers.ts`
- Impact: Increased bundle size (~300 KB); no tree-shaking; future security fixes may not be released.
- Fix approach: Migrate to `date-fns` (already available in many TS projects) or `dayjs`.

**Business logic in ScheduleController:**
- Issue: `ScheduleController.getAllSchedules()` contains ~150 lines of recurring schedule expansion logic that belongs in a service layer. The controller is 438 lines — the largest controller by far.
- Files: `src/controllers/ScheduleController.ts:30-175`
- Impact: Untestable business logic; controller-level bugs hard to isolate; no reuse from other contexts.
- Fix approach: Extract recurring schedule expansion into `ScheduleService.expandRecurringSchedules()`.

**`catchAsync` utility defined but never used:**
- Issue: `catchAsync` wrapper is defined in `src/middleware/errorHandler.ts` but all controllers use manual try/catch blocks instead.
- Files: `src/middleware/errorHandler.ts:88`, all 7 controller files
- Impact: Inconsistency; 34 redundant try/catch blocks that each make HTTP responses directly instead of delegating to the global error handler.
- Fix approach: Either remove `catchAsync` (and keep manual try/catch) or migrate controllers to use it consistently.

**Non-standard subdocument field name:**
- Issue: `ClassSchedule.sessions[]` contains a field named `S-instructor` (with hyphen) that is stored in MongoDB and accessed via `['S-instructor']` bracket notation throughout the codebase.
- Files: `src/models/ClassSchedule.ts:127`, `src/controllers/ScheduleController.ts:113`
- Impact: Cannot be accessed with dot notation; confuses TypeScript; inconsistent with the `instructor` field elsewhere; MongoDB queries against this field require careful escaping.
- Fix approach: Rename to `instructor` (matching other schedule fields) and run a migration script.

**Dead/disabled code left in repository:**
- Issue: `frontend/src/app/api/_disabled_path_backup/route.ts` is a disabled proxy route left in a specially named directory.
- Files: `frontend/src/app/api/_disabled_path_backup/route.ts`
- Impact: Maintenance confusion; risk of accidental re-enabling.
- Fix approach: Delete the file or move to a non-app directory with a clear comment in git history.

---

## Security Concerns

**Raw `error.message` exposed in API responses:**
- Risk: 34 HTTP responses across controllers include `error: error.message` directly. MongoDB errors, Mongoose validation messages, and internal library errors are returned verbatim to clients.
- Files: `src/controllers/StudentController.ts`, `src/controllers/ClassController.ts`, `src/controllers/ScheduleController.ts`, `src/controllers/UserController.ts`
- Current mitigation: `errorHandler.ts` strips stack traces in production, but controllers respond before reaching the global handler.
- Recommendations: Never include raw `error.message` in HTTP responses outside the global error handler. Use generic messages per error type.

**`apiLimiter` defined but never applied:**
- Risk: The general rate limiter (`apiLimiter`) is defined in `src/middleware/rateLimiter.ts` but is not applied to any route. Only auth endpoints are rate-limited.
- Files: `src/middleware/rateLimiter.ts:30`, `src/index.ts`
- Current mitigation: `authLimiter` protects `/api/auth/login` only.
- Recommendations: Apply `apiLimiter` globally in `src/index.ts` before all route mounts, or at minimum on write endpoints.

**Refresh token endpoint has no rate limiting:**
- Risk: `/api/auth/refresh-token` has no rate limiting, allowing unlimited token refresh attempts.
- Files: `src/routes/authRoutes.ts:29`, `src/middleware/rateLimiter.ts`
- Current mitigation: None.
- Recommendations: Apply `authLimiter` (or a dedicated refresh limiter) to the refresh token route.

**No JWT blacklist / token revocation:**
- Risk: Issued access tokens (24h) and refresh tokens (7d) cannot be revoked. A compromised token remains valid for its full lifetime—logout, password change, or account deactivation does not immediately invalidate existing tokens.
- Files: `src/utils/jwt.ts`, `src/controllers/AuthController.ts`, `frontend/src/app/api/auth/[...nextauth]/route.ts`
- Current mitigation: `changedPasswordAfter()` check invalidates tokens after password change for the access token path only.
- Recommendations: Store refresh tokens in the database and delete on logout; consider short-lived access tokens (15-30 min) with refresh rotation.

**No request body size limit:**
- Risk: `express.json()` is called without a `limit` option, accepting arbitrarily large JSON bodies. A malicious client could send multi-megabyte payloads to exhaust memory.
- Files: `src/middleware/middleware.ts:25`
- Current mitigation: None (Helmet does not protect against this).
- Recommendations: Add `app.use(express.json({ limit: '1mb' }))`.

**DB hit on every authenticated request:**
- Risk: `authenticate` middleware fetches the full user record from MongoDB on every request and potentially calls `user.save()` every 5 minutes. This creates a tight coupling between API availability and MongoDB latency.
- Files: `src/middleware/auth.ts:46-85`
- Current mitigation: Last-login update is throttled to once per 5 minutes.
- Recommendations: Cache user status in the JWT claims to avoid DB lookup for the common case; only query DB when token fields indicate user may have changed.

---

## Performance Bottlenecks

**Unbounded list queries (no pagination):**
- Problem: `getAllStudents`, `getAllClasses`, and `getAllUsers` return all documents with no limit, skip, or pagination.
- Files: `src/controllers/StudentController.ts:10`, `src/controllers/ClassController.ts:10`, `src/controllers/UserController.ts:13`
- Cause: `StudentModel.find({})` with no `.limit()`.
- Improvement path: Add `page`/`limit` query params and `.skip().limit()` on all list endpoints.

**In-memory recurring schedule expansion:**
- Problem: When `expandRecurring=true`, `getAllSchedules` fetches all recurring schedules that overlap the requested date range and expands them entirely in Node.js memory, then sorts the resulting array. A range of 6 months with many recurring classes will produce thousands of in-memory objects.
- Files: `src/controllers/ScheduleController.ts:30-175`
- Cause: No server-side materialization of recurrences.
- Improvement path: Pre-materialize instances when schedules are created/updated (write-time expansion), or add pagination and cap the expansion window.

**Pre-save hook queries DB on every schedule save:**
- Problem: The `classScheduleSchema.pre('save')` hook calls `ClassModel.exists({ _id: this.class_id })` synchronously before every `.save()` call, including the batch saves in `markMultipleAttendance`.
- Files: `src/models/ClassSchedule.ts:151-156`
- Cause: Referential integrity check at model layer.
- Improvement path: Move the check to a service-level validation run once per operation, not per document.

**`generateAttendanceReports` multi-stage aggregation with no caching:**
- Problem: Aggregation pipeline does 3 `$lookup` joins (students, schedules, classes) on the full attendance collection.
- Files: `src/services/AttendanceService.ts:417-553`
- Cause: No index on `attendance.date` (only compound index on `student_id + class_schedule_id + date`).
- Improvement path: Add single-field index on `attendance.date`; add response caching (Redis or in-memory TTL cache) for report endpoints.

---

## Fragile Areas

**Debug `console.log` left in `ScheduleController` production code:**
- Files: `src/controllers/ScheduleController.ts:12, 44, 65-69, 91-93, 107-108, 112, 141` (24 `console.log` calls in production path)
- Why fragile: Logs internal object shapes, schedule IDs, and session data to stdout in production. Generates significant log volume.
- Safe modification: Remove all debug logs before any deployment; replace with structured conditional logging.
- Test coverage: No tests for `ScheduleController`.

**`ConfigService` singleton with hard startup dependency:**
- Files: `src/services/ConfigService.ts`, `src/index.ts:84-89`, `src/models/Attendance.ts:55-62`, `src/models/Student.ts`
- Why fragile: `ConfigService.initialize()` must succeed at startup or the process exits. Model validators call `ConfigService.getInstance()` synchronously; if called before initialization they return an uninitialized state. The singleton pattern makes testing hard without explicit reset.
- Safe modification: Tests must call `ConfigService.initialize()` in `setup.ts` before running; see `src/test/setup.ts` for the pattern.
- Test coverage: `ConfigService.test.ts` exists but casts instance to `any` to access private members.

**`ScheduleController.updateSchedule` uses dynamic property assignment:**
- Files: `src/controllers/ScheduleController.ts:326`
- Why fragile: `(schedule as any)[key as keyof typeof schedule] = updateData[key]` allows arbitrary field assignment, bypassing Mongoose schema validation for updates.
- Safe modification: Use an explicit allowlist of updatable fields and `findByIdAndUpdate` instead.

**Student `updateStudent` uses raw `$set/$unset` construction:**
- Files: `src/controllers/StudentController.ts:78-95`
- Why fragile: `updateOps: any = { $set: {} }` built from arbitrary request body keys. An attacker who bypasses Joi validation could inject MongoDB operators.
- Safe modification: Use an allowlist of safe field names before building the update object; Joi validation is the primary guard but should be verified at this layer too.

---

## Missing Critical Features

**No password reset / forgot-password flow:**
- Problem: Users who forget their password have no self-service recovery mechanism. An admin must manually reset passwords.
- Blocks: Self-service onboarding for any non-admin role.

**No account email verification:**
- Problem: Users can be created with any email address; no verification step exists.
- Blocks: Email-based notifications and password recovery.

**No audit trail for attendance edits:**
- Problem: Attendance records can be created and updated with no history of changes, who made them, or when.
- Blocks: Accurate historical reporting; dispute resolution.

**Student role incomplete:**
- Problem: `UserRoleEnum.STUDENT` exists and `restrictToOwnResource` middleware is defined, but students cannot self-register or view their own attendance via the API. The middleware's instructor-restriction path is a stub comment only.
- Files: `src/middleware/auth.ts:145-165`, `src/routes/studentRoutes.ts`

---

## Test Coverage Gaps

**Coverage thresholds set below industry standard:**
- Files: `jest.config.js:18-25`
- What's not tested: Thresholds are 50% branches / 60% functions/lines/statements — an explicit comment notes these were "relaxed to allow incremental test additions."

**Large untested surface area in controllers:**
- What's not tested: `UserController`, `StudentController`, `ClassController`, `ScheduleController`, `AuthController` — 5 of 7 controllers have no test files.
- Files: `src/controllers/` (5 untested files)
- Risk: Any regression in HTTP handling, validation flow, or error response format goes undetected.
- Priority: High

**Missing model tests:**
- What's not tested: `StudentModel`, `AttendanceModel`, `UserModel` — only `ClassModel` has a test.
- Files: `src/models/` (3 untested files)
- Risk: Schema validators, pre-save hooks, and password hashing are untested.
- Priority: High

**Missing utility and middleware tests:**
- What's not tested: `errorHandler`, `rateLimiter`, `jwt.ts` (signToken, signRefreshToken, verifyRefreshToken), `timeHelpers.ts`.
- Files: `src/utils/jwt.ts`, `src/middleware/errorHandler.ts`, `src/middleware/rateLimiter.ts`, `src/utilities/timeHelpers.ts`
- Risk: JWT expiry handling, rate limiter logic, and error transformation are untested.
- Priority: Medium

**No frontend tests:**
- What's not tested: All Next.js pages and components. `jest.config.js` includes `frontend/src` in roots, but no `*.test.ts` files exist there.
- Files: `frontend/src/` (entire directory)
- Risk: UI regressions, broken auth flows, and API integration errors go undetected.
- Priority: Medium

---

## Dependencies at Risk

**`moment` (^2.30.1):**
- Risk: Officially deprecated by maintainers; no new features; large bundle size (~300 KB minified).
- Impact: Every import includes the full library; no tree-shaking possible.
- Migration plan: `date-fns` (tree-shakeable, TypeScript-native) or `dayjs` (moment-compatible API).

**`mongodb-memory-server` (test dependency):**
- Risk: Each test run downloads a MongoDB binary if not cached; flaky in CI environments with restricted internet access.
- Impact: Slow or broken CI if cache is cold.
- Migration plan: Pin the binary version and check in to `.cache/` per project; or switch to `@shelf/jest-mongodb` with explicit binary management.

---

*Concerns audit: 2026-04-13*
