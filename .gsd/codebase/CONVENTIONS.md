# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- PascalCase for class files: `AttendanceController.ts`, `StudentModel.ts`, `AttendanceService.ts`
- camelCase for utility/helper files: `jwt.ts`, `timeHelpers.ts`, `validators.ts`
- PascalCase for model files: `Attendance.ts`, `ClassSchedule.ts`, `User.ts`
- Route files: camelCase + "Routes" suffix — `attendanceRoutes.ts`, `classRoutes.ts`

**Classes:**
- PascalCase: `AttendanceController`, `AttendanceService`, `ConfigService`, `TimeHelpers`
- Singleton services export both the class and an instance: `export class AttendanceController` + `export const attendanceController = new AttendanceController()`

**Functions and methods:**
- camelCase: `getTodaysClasses`, `markAttendance`, `signToken`, `verifyToken`
- Controller handler methods are arrow function class properties (not prototype methods):
  ```typescript
  markAttendance = async (req: Request, res: Response): Promise<void> => { ... };
  ```
- Prefix unused parameters with `_`: `_next: NextFunction` (enforced by ESLint)

**Variables:**
- camelCase: `attendanceService`, `testClassId`, `startOfDay`
- snake_case for database field names that map to MongoDB documents: `class_schedule_id`, `belt_level`, `emergency_contact`, `start_time`

**Types / Interfaces / Enums:**
- Interfaces prefixed with `I`: `IStudentDocument`, `IClassInfo`, `IAttendanceDocument`
- Enums suffixed with `Enum`: `StudentCategoryEnum`, `AttendanceStatusEnum`, `UserRoleEnum`
- Type aliases created alongside enums for ergonomics:
  ```typescript
  export type StudentCategory = StudentCategoryEnum;
  ```
- DTOs suffixed with `Dto`: `MarkAttendanceDto`, `CreateStudentDto`
- All types centralized in `src/types/interfaces.ts`

## Code Style

**Formatting:**
- No Prettier config detected — formatting is manual/editor-driven
- Consistent 2-space indentation throughout

**Linting (Backend — `eslint.config.mjs`):**
- ESLint 9 flat config
- `@typescript-eslint/no-unused-vars` as `warn` with `argsIgnorePattern: '^_'`
- `no-undef` off (TypeScript handles it)

**Linting (Frontend — `frontend/eslint.config.mjs`):**
- Same base rules plus React + react-hooks plugins
- `react/react-in-jsx-scope: off` (Next.js handles React import)
- `react/prop-types: off`

**TypeScript:**
- `strict: true` in both backend and frontend tsconfigs
- `useUnknownInCatchVariables: false` (allows `error as Error` casts without extra narrowing)
- Path alias `@/*` → `src/*` in backend; same alias `@/*` → `./src/*` in frontend
- `experimentalDecorators` and `emitDecoratorMetadata` enabled in backend

## Import Organization

**Order (observed across source files):**
1. Node/framework packages (`express`, `mongoose`, `moment`, `jwt`)
2. Internal type imports from `../types/interfaces` or `@/types/interfaces`
3. Internal service imports
4. Internal model imports

**Path Aliases:**
- Routes use `@/` alias: `import { attendanceController } from '@/controllers/AttendanceController'`
- Most other src files use relative paths: `import { UserModel } from '../models/User'`

**File header comment pattern:**
```typescript
// src/controllers/AttendanceController.ts - Attendance business logic
```
Used consistently at the top of most source files.

## Response Format

All API endpoints return a uniform shape:
```typescript
// Success
res.json({ success: true, data: result });

// Error
res.status(500).json({
  success: false,
  message: 'Descriptive error message',
  error: (error as Error).message
});

// Validation error (from middleware)
res.status(400).json({
  success: false,
  message: 'Validation error',
  details: error.details.map(detail => detail.message)
});
```

## Error Handling

**Strategy:**
- Controllers use `try/catch`; service errors propagate upward via thrown exceptions
- Global `errorHandler` middleware (`src/middleware/errorHandler.ts`) transforms Mongoose errors (CastError, duplicate key, ValidationError) and JWT errors to HTTP responses
- Services throw descriptive `Error` objects or custom `ValidationError` instances

**Custom error class:**
```typescript
// src/utils/validators.ts
export class ValidationError extends Error { ... }
```

**Type-narrowing for catch blocks:**
```typescript
error: (error as Error).message  // pattern used in controllers

// In services, a type guard is used:
function isErrorWithMessage(error: unknown): error is { message: string } { ... }
```

**`as any` usage:**
- Present in several places to work around Mongoose typing gaps (e.g., `schedule.sessions[i].status = 'completed' as any`)
- Used in controllers for query param casts: `category as any`
- Avoid adding new `as any` — prefer proper type narrowing or `unknown`

## Validation

**Two-layer validation:**
1. **Joi**: Route-level schemas in route files (`src/routes/`) or `src/utilities/validators.ts`; applied via `validateRequest(schema)` middleware
2. **Mongoose**: Schema-level validators using `validate.validator` / `validate.message`; both call `ConfigService.getInstance()` for dynamic values

**Validators integrate with ConfigService:**
```typescript
validator: function(values: string[]) {
  const configService = ConfigService.getInstance();
  return values.every(val => configService.isValidCategory(val));
}
```

## Logging

**Framework:** `console.error` (no structured logging library)

**Patterns:**
- Global error handler logs with timestamp and status code:
  ```typescript
  console.error(`❌ [${new Date().toISOString()}] ${error.statusCode} - ${error.message}`);
  ```
- Test setup uses `console.warn` for non-fatal init failures

## Comments

**When to Comment:**
- File-level comment with path and purpose on all source files
- Numbered comments to explain multi-step logic (e.g., auth middleware: `// 1. Extract token`, `// 2. Verify token`)
- `// TODO:` for known missing work (2 instances: delete cascade in controllers)

**JSDoc:** Used on utility functions in `src/utils/jwt.ts` with `@param` and `@returns`/`@throws`

## Module Design

**Exports:**
- Named exports throughout (no default exports)
- Classes exported alongside instances for dependency use:
  ```typescript
  export class AttendanceController { ... }
  export const attendanceController = new AttendanceController();
  ```
- Enums, interfaces, and types all from `src/types/interfaces.ts` — import from there, not from models

**Services as classes:** Business logic lives in instantiated classes (`new AttendanceService()`), controllers hold a private instance of their service

---

*Convention analysis: 2026-04-13*
