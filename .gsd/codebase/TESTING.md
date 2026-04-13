# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Runner:**
- Jest with `ts-jest` preset
- Config: `jest.config.js` (CommonJS)
- Test environment: `node`

**Assertion Library:**
- Jest built-in (`expect`, matchers)

**Run Commands:**
```bash
pnpm test                        # Run all tests + coverage
```

## Test File Organization

**Location:**
- Backend: `src/__tests__/` — separate from source, mirrors `src/` structure
- Frontend: `frontend/src/__tests__/` — one file currently

**Naming:**
- `*.test.ts` pattern
- Mirrors source structure: `src/controllers/AttendanceController.ts` → `src/__tests__/controllers/AttendanceController.test.ts`

**Structure:**
```
src/__tests__/
├── controllers/
│   └── AttendanceController.test.ts
├── middleware/
│   └── auth.test.ts
├── models/
│   └── ClassModel.test.ts
├── services/
│   ├── AttendanceService.test.ts
│   └── ConfigService.test.ts
├── utilities/
│   └── timeHelpers.test.ts
└── utils/
    ├── jwt.test.ts
    └── validators.test.ts

frontend/src/__tests__/
└── buildAttendancePayload.test.ts
```

## Test Setup

**Global setup file:** `src/test/setup.ts`

- Starts `MongoMemoryServer` before all tests
- Connects Mongoose to in-memory URI
- Initializes `ConfigService` (reads `config/system.yaml`)
- Clears all collections after each test via `afterEach`
- Disconnects and stops server after all tests

```typescript
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await ConfigService.initialize();
});

afterEach(async () => {
  for (const key in mongoose.connection.collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
```

## Test Structure

**Suite Organization:**
```typescript
describe('ClassName or module', () => {
  // shared mocks/instances declared here

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('describes expected behavior', async () => {
    // arrange → act → assert
  });

  describe('methodName', () => {
    it('specific scenario', async () => { ... });
  });
});
```

- Flat `it()` for simple modules; nested `describe()` blocks for method grouping in complex services
- Test descriptions use plain English, not "should..." (see `AttendanceController.test.ts`) — though some service tests do use "should" prefix

## Mocking

**Framework:** `jest.mock()`, `jest.spyOn()`, `jest.fn()`

**Module mocking (whole module replacement):**
```typescript
// auth.test.ts — mock JWT util entirely
jest.mock('../../utils/jwt');
// then within test:
(verifyToken as jest.Mock).mockReturnValue({ id: 'u1', iat: ... });
```

**Spy mocking (partial mock of an instance):**
```typescript
// AttendanceController.test.ts — spy on private service
const service = (controller as any).attendanceService;
jest.spyOn(service, 'getClassesForDate').mockResolvedValue([{ id: 'c1' }]);
```

**Service singleton mocking:**
```typescript
// validators.test.ts — mock ConfigService singleton
jest.mock('../../services/ConfigService');
(ConfigService.getInstance as jest.Mock).mockReturnValue({
  isValidCategory: jest.fn(),
  getCategoryValues: jest.fn()
});
```

**What to mock:**
- External dependencies in unit tests (JWT, ConfigService when testing validators)
- Private service instances inside controllers (access via `(controller as any).serviceName`)
- Database operations in controller tests (spy on service, not the model)
- `Date.now` when testing time-based logic: `jest.spyOn(Date, 'now').mockReturnValue(...)`

**What NOT to mock:**
- Mongoose models in service tests — use in-memory MongoDB from global setup
- ConfigService in model/service integration tests — the real config file is present

## Express Request/Response Mocking

Minimal manual mocks for Express objects in controller/middleware tests:
```typescript
const json = jest.fn();
const status = jest.fn(() => ({ json })) as any;
const res: any = { json, status };
const req: any = { headers: {}, params: {}, query: {}, user: { _id: 'u1' } };
const next = jest.fn();
```

Pattern for chained res methods (`res.status().json()`):
```typescript
const res: any = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
};
```

## Fixtures and Factories

**Test data:** Created inline in `beforeEach` using real Mongoose model `.create()` calls:
```typescript
beforeEach(async () => {
  const testClass = await ClassModel.create({
    name: 'Test Class',
    categories: [StudentCategoryEnum.KIDS],
    instructor: 'Test Instructor',
    max_capacity: 30,
    duration_minutes: 60
  });
  testClassId = testClass._id;
});
```

**Location:** Inline in each test file — no shared factory utilities or fixtures directory

## Coverage

**Requirements:**
```
branches:   50%
functions:  60%
lines:      60%
statements: 60%
```
(Thresholds relaxed to allow incremental test additions — comment in `jest.config.js`)

**Coverage output:** `coverage/` directory (lcov + clover + JSON)

**Excluded from coverage:**
- `src/**/*.d.ts`
- `src/**/index.ts`
- `src/**/types/**`
- `src/**/__mocks__/**`
- `src/**/__tests__/**`

**View Coverage:**
```bash
pnpm test   # coverage generated automatically
# then open coverage/lcov-report/index.html
```

## Test Types

**Unit Tests:**
- Controller tests: isolate via service spies, no DB, no real HTTP
- Middleware tests: isolate via module mocks, manual req/res objects
- Utility tests (jwt, validators, timeHelpers): pure function tests with targeted mocks

**Integration Tests:**
- Service tests: real in-memory MongoDB, real Mongoose documents — verify data persists and business rules apply
- Model tests: real Mongoose validation and schema rules against in-memory MongoDB

**E2E Tests:**
- Not present

**Frontend Tests:**
- Pure function tests only (utility functions)
- No component rendering tests (no React Testing Library or similar)

## Common Patterns

**Async Testing:**
```typescript
it('marks attendance for multiple students', async () => {
  const results = await attendanceService.markMultipleAttendance(testData, 'test@example.com');
  expect(results).toHaveLength(1);
  expect(results[0].success).toBe(true);
});
```

**Error Testing:**
```typescript
// Rejection with toThrow
await expect(cls.save()).rejects.toThrow(/Invalid class category/i);

// Service error result object
expect(results[0].success).toBe(false);
expect(results[0].error).toBeDefined();
```

**Env vars in tests:**
```typescript
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});
afterAll(() => {
  process.env = { ...originalEnv };
});
```

**ConfigService in tests:**
- Model and service tests call `await ConfigService.initialize()` in a local `beforeAll` as a defensive guard (the global setup.ts already handles this, but tests add it for resilience)
- Set instance state directly when testing ConfigService itself: `(instance as any).config = baseConfig`

---

*Testing analysis: 2026-04-13*
