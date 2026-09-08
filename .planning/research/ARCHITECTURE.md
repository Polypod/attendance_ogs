# Architecture Research

**Domain:** Reporting (raw data + aggregated) for attendance system
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js App Router)                     │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐    ┌───────────────────────────────────────┐  │
│  │ /dashboard/reports     │    │ frontend/src/lib/api.ts               │  │
│  │ ReportsPage (client)   │───▶│ fetchWithAuth() → REST calls          │  │
│  └─────────────┬─────────┘    └───────────────────┬───────────────────┘  │
│                │                                   │                      │
└────────────────┼───────────────────────────────────┼──────────────────────┘
                 │                                   │
                 ▼                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Backend (Express + Mongoose)                    │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐    ┌───────────────────────────────────────┐  │
│  │ src/routes/reports*    │───▶│ src/controllers/ReportController.ts   │  │
│  │ src/routes/report...   │    │ HTTP only: validate + call service    │  │
│  └─────────────┬─────────┘    └───────────────────┬───────────────────┘  │
│                │                                   │                      │
│     authorize(ADMIN, INSTRUCTOR)                   ▼                      │
│  ┌───────────────────────┐    ┌───────────────────────────────────────┐  │
│  │ Joi validateRequest() │───▶│ src/services/ReportService.ts          │  │
│  │ (query/preset DTO)    │    │ Builds aggregation pipeline + paging   │  │
│  └───────────────────────┘    └───────────────────┬───────────────────┘  │
│                                                    │                      │
│                                                    ▼                      │
│                               ┌───────────────────────────────────────┐  │
│                               │ src/services/ReportPresetService.ts    │  │
│                               │ CRUD presets + access policy           │  │
│                               └───────────────────┬───────────────────┘  │
└────────────────────────────────────────────────────┼──────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                                MongoDB                                    │
├───────────────────────────────────────────────────────────────────────────┤
│  Collections: Attendance, Student, ClassSchedule, Class, User, ReportPreset│
│  Query: find()/aggregate() + $lookup + $group + $facet + cursor()         │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
| --------- | -------------- | ---------------------- |
| ReportsPage | UI for raw/agg, filters/sort, columns, presets, export | Next.js client component + shadcn table |
| API client | Standardizes requests, injects auth token | `frontend/src/lib/api.ts` |
| ReportController | Receives query/export, sets headers, returns JSON/CSV | Express controller (no business logic) |
| ReportService | Translates ReportQuery → Mongo filter/pipeline, paging, sort, column projection | Mongoose `aggregate()` + pipeline builder |
| ReportPresetService | Create/list/update/delete presets with policy (private/shared) | Mongoose model CRUD + access checks |
| ReportPresetModel | Stores preset definitions per user + shared flag | New Mongoose model |

## Recommended Project Structure

```text
src/
├── controllers/
│   ├── ReportController.ts              # Query + export endpoints
│   └── ReportPresetController.ts        # Preset CRUD
├── services/
│   ├── ReportService.ts                 # Raw + aggregated query engine
│   ├── ReportPresetService.ts           # Preset CRUD + access policy
│   └── reportQuery/                     # (optional) pipeline builders
│       ├── reportQueryTypes.ts          # (alt: place in src/types/interfaces.ts)
│       ├── buildMatch.ts
│       ├── buildPipelineRaw.ts
│       ├── buildPipelineAgg.ts
│       └── csvExport.ts
├── models/
│   └── ReportPreset.ts                  # New collection
├── routes/
│   ├── reportRoutes.ts                  # /api/reports/query + /export
│   └── reportPresetRoutes.ts            # /api/report-presets
├── types/
│   ├── interfaces.ts                    # Report DTOs/Enums (if following existing convention)
│   └── validation.ts                    # Joi schemas (alternatively near routes)
└── middleware/
    └── validation.ts                    # validateRequest(schema) (existing)

frontend/src/
├── app/
│   └── dashboard/
│       └── reports/
│           └── page.tsx                 # Reports page
├── components/
│   └── reports/
│       ├── ReportsTable.tsx             # Table + pagination
│       ├── ReportsToolbar.tsx           # filter/sort/search/export
│       ├── ColumnPicker.tsx             # show/hide columns
│       └── PresetMenu.tsx               # save/load/share
├── lib/
│   └── api.ts                           # fetchWithAuth (existing)
└── types/
    └── reports.ts                       # Frontend types for query state
```

### Structure Rationale

- **Separate reports module**: The current `AttendanceService.generateAttendanceReports()` is a good reference, but the new reports page needs a more general query API (raw + multiple aggregates), so a dedicated `ReportService` reduces the risk of a “god service” that grows uncontrollably.
- **Preset as its own model**: Presets are user- and UI-specific (columns/sort/filter/grouping). Storing them as documents in MongoDB provides easy sync across devices and support for “shared” presets.
- **Whitelisting**: For filtering/sorting/columns, the backend must enforce allowed fields and operators; otherwise there is a risk of NoSQL injection and unintended field leakage.

## Implementation / Build Order

Recommended order to minimize rework and enable early testing:

1. **Define Query DSL + preset schema (types)**
   - `ReportMode = 'raw' | 'aggregate'`
   - `ReportView = 'attendance'` (if more report types may be added later)
   - `ReportColumnKey` (whitelist) and `ReportFilter` (whitelist + operators)

2. **Create `ReportPreset` model**
   - Minimal schema + index for `(owner_user_id, is_shared, scope)`.

3. **Implement `ReportPresetService` + endpoints**
   - The UI can test “save and load view” early, even if the report query is still rudimentary.

4. **Implement `ReportService.query()` (raw mode) with paging + sort + filter**
   - Start with the most important fields: date range, status, category, student-id, class-id, recorded_by.

5. **Add `ReportService.query()` (aggregate mode) with standard groupings**
   - Group by: student, instructor, class/session (`class_schedule`), class.
   - Metrics: count per status + total.

6. **Implement CSV export server-side (streaming)**
   - Build on the same query DSL and the same whitelist column logic.

7. **Frontend ReportsPage (MVP UI):**
   - Table with two tabs: “Raw Data” and “Aggregated”.
   - Filter + sort + search + column picker.

8. **Frontend presets + sharing + export button**
   - Connect to preset endpoints.
   - CSV export should export *the entire filtered result set* and only active columns.

## API Endpoints (proposal)

**Reports (data):**

- `POST /api/reports/query`
  - Body: `ReportQueryDto`
  - Return: `{ success: true, data: { items: any[]; total: number } }`
  - Purpose: table results (raw or aggregated) with pagination.

- `POST /api/reports/export`
  - Body: `ReportQueryDto` (same as `/query`, but paging is ignored)
  - Return: `text/csv` stream (attachment)
  - Purpose: export *the entire filtered result set* with selected columns.

**Presets (view settings):**

- `GET /api/report-presets?view=attendance`
  - Return: private presets (owner = req.user) + shared presets.

- `POST /api/report-presets`
  - Body: `{ name, is_shared, view, definition: ReportQueryDto | ReportPresetDefinition }`

- `PUT /api/report-presets/:presetId`
  - Policy: owner can change private; shared requires admin (recommended).

- `DELETE /api/report-presets/:presetId`
  - Policy: owner or admin.

**Backward compatibility (existing):**

- `GET /api/attendance/reports/:dateRange`
  - Can remain as a “legacy report” until the reports page moves to the new API.

## Architectural Patterns

### Pattern 1: Whitelisted Report Query DSL (safe query construction)

**What:** Send a constrained JSON format (DTO) from the frontend that the backend translates into Mongo match/sort/projection via a whitelist map.

**When to use:** Always when the UI has dynamic filters/sort/columns.

**Trade-offs:**

- Advantage: Prevents query injection and “field path spelunking”.
- Advantage: Stable contract between UI and backend.
- Drawback: Requires explicit mapping and a bit more code than “send Mongo query directly”.

**Example:**

```typescript
export type ReportMode = 'raw' | 'aggregate';

export type ReportFilterOp = 'eq' | 'in' | 'contains' | 'gte' | 'lte';

export type ReportFilter = {
  key:
    | 'date'
    | 'status'
    | 'category'
    | 'student_id'
    | 'class_schedule_id'
    | 'class_id'
    | 'instructor'
    | 'recorded_by'
    | 'q';
  op: ReportFilterOp;
  value: string | string[];
};

export type ReportSort = { key: string; dir: 'asc' | 'desc' };

export interface ReportQueryDto {
  mode: ReportMode;
  view: 'attendance';
  filters: ReportFilter[];
  sort?: ReportSort[];
  columns: string[]; // ReportColumnKey[] in practice
  page?: number;
  pageSize?: number;
}

const RAW_FIELD_MAP: Record<string, string> = {
  date: 'date',
  status: 'status',
  category: 'category',
  recorded_by: 'recorded_by'
  // NOTE: student/class fields are built via $lookup and $addFields
};
```

### Pattern 2: Pipeline builder + `$facet` for “items + total”

**What:** Build an aggregation pipeline that (a) joins required collections via `$lookup`, (b) applies `$match` based on the whitelist, (c) paginates and returns `items` + `total` in one call via `$facet`.

**When to use:** Raw table and aggregated table where the UI needs pagination.

**Trade-offs:**

- Advantage: One roundtrip and consistent total.
- Advantage: Avoids N+1 populates.
- Drawback: Aggregations can become expensive without indexes/scoping.

**Example:**

```typescript
const pipeline = [
  { $match: { /* date/status/category etc */ } },
  { $lookup: { from: 'students', localField: 'student_id', foreignField: '_id', as: 'student' } },
  { $unwind: '$student' },
  { $lookup: { from: 'classschedules', localField: 'class_schedule_id', foreignField: '_id', as: 'schedule' } },
  { $unwind: '$schedule' },
  { $lookup: { from: 'classes', localField: 'schedule.class_id', foreignField: '_id', as: 'class' } },
  { $unwind: '$class' },

  // (optional) normalize fields for sort/search
  { $addFields: { student_name: '$student.name', class_name: '$class.name', instructor: '$class.instructor' } },

  { $facet: {
      items: [
        { $sort: { date: -1 } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
        { $project: { /* projection based on columns */ } }
      ],
      total: [ { $count: 'count' } ]
    }
  }
];
```

### Pattern 3: Streaming CSV export (server-side, “the entire filtered result set”)

**What:** Export should not build the entire result set in memory and should not require the client to “page through” every page. Use an aggregation cursor and write CSV row by row.

**When to use:** Always when export can exceed individual pages.

**Trade-offs:**

- Advantage: Memory-efficient and robust.
- Advantage: Same filter/sort/columns as the view.
- Drawback: Requires a bit more care around backpressure and correct CSV escaping.

**Example:**

```typescript
// Mongoose supports aggregation cursors for large result sets
const cursor = AttendanceModel
  .aggregate(exportPipeline)
  .cursor({ batchSize: 1000 });

res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');

res.write(columns.join(',') + '\n');

for await (const row of cursor) {
  res.write(serializeCsvRow(row, columns) + '\n');
}

res.end();
```

## Data Flow

### Request Flow

```text
[User adjusts filters/sort/columns/preset]
    ↓
[ReportsPage state → ReportQueryDto]
    ↓
POST /api/reports/query
    ↓
ReportController → ReportService (build match/pipeline)
    ↓
MongoDB aggregate() → { items, total }
    ↓
JSON response → UI renders table
```

### State Management

```text
(React state / useReducer)
    ↓
ReportQueryDto (single source of truth for the view)
    ↓
Persistence:
- “Save preset” → POST /api/report-presets
- “Load preset” → GET /api/report-presets
```

### Key Data Flows

1. **Raw report:** Attendance rows + `$lookup` for student/class/schedule, filter/sort, column projection.
2. **Aggregated report:** Same base match + join, then `$group` according to the selected standard grouping (student/instructor/class session/class).
3. **CSV export:** Same query (without paging) + streaming to response.

## Scaling Considerations

| Scale | Architecture Adjustments |
| ----- | ------------------------ |
| 0-1k users / small data volumes | Monolith + aggregation pipelines are sufficient. CSV can be generated on demand. |
| 1k-100k users / growing data | Add indexes on Attendance (date/status/category/student_id/class_schedule_id). Avoid “contains” regex on joined fields. Enforce strict paging in the UI. |
| 100k+ / large history | Consider denormalized “report fields” (student_name, class_name, instructor) on Attendance, or a materialized “ReportFact” collection per day/session. |

### Scaling Priorities

1. **First bottleneck:** free-text search (`q`) across joined fields (regex) + large date ranges.
   - Mitigation: require date range, limit search to certain fields, indexing/denormalization.

2. **Second bottleneck:** CSV export of large datasets.
   - Mitigation: streaming cursor + batchSize, `allowDiskUse(true)` for aggregation, rate limit per user.

## Anti-Patterns

### Anti-Pattern 1: “Send Mongo query directly from frontend”

**What people do:** Let the UI send free-form `{ $match: ... }` or field paths (e.g. `"student.name"`) and inject them into the pipeline.

**Why it's wrong:** Opens the door to NoSQL injection, accidental `$` operators, and data leaks through uncontrolled projection.

**Do this instead:** Use a whitelisted DSL (`ReportFilter`, `ReportColumnKey`) and build the match/pipeline in the backend.

### Anti-Pattern 2: CSV export in the client via “fetch all pages”

**What people do:** Load page 1..N in the browser and build the CSV locally.

**Why it's wrong:** Slow, fragile, risks memory issues and timeouts, and gives different results depending on paging.

**Do this instead:** Server-side export with a streaming cursor and the exact same query as the view.

### Anti-Pattern 3: N+1 populates per row

**What people do:** Fetch `Attendance.find()` and run separate queries per row for student/class.

**Why it's wrong:** Explodes the number of DB queries and becomes slow quickly.

**Do this instead:** `$lookup`-based aggregation (or a single `.populate()` query without a per-row loop) and projection based on column selection.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
| ------- | ------------------- | ----- |
| (none) | — | Reports are internal DB query + export. |

### Internal Boundaries

| Boundary | Communication | Notes |
| -------- | ------------- | ----- |
| Reports UI ↔ Backend API | REST (`POST /api/reports/query`, `POST /api/reports/export`) | Use the same `ReportQueryDto` for both. |
| Presets UI ↔ Preset API | REST CRUD | Policy: always private, shared only if `is_shared=true` and authorized. |
| ReportService ↔ MongoDB | Mongoose `aggregate()` + cursor | Mongoose does not automatically cast pipeline stages → manual `ObjectId` where needed. |
| Reports ↔ Auth | `authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR)` | Same access as existing reports. |
| Reports ↔ Config | Use existing `/api/config` for category lists | Avoid a new “metadata endpoint” unless needed. |

## Sources

- MongoDB Manual — Aggregation Pipeline: <https://www.mongodb.com/docs/manual/core/aggregation-pipeline/>
- Mongoose docs — Aggregate + cursor(): <https://mongoosejs.com/docs/api/aggregate.html>
- Next.js docs — App Router: <https://nextjs.org/docs/app>

---
*Architecture research for: reporting in attendance_ogs*
*Researched: 2026-04-13*
