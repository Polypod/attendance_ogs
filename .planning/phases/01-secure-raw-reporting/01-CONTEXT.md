# Phase 1: Secure Raw Reporting - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>

## Phase Boundary

This phase delivers a new Reports page in the dashboard as well as a new report API for **raw data** (one row per attendance record) with:

- RBAC (ADMIN + INSTRUCTOR only)
- Date range (from–to) with a clear timezone rule
- Field filters (at minimum student, instructor, class/session, status)
- Server-side pagination

Aggregations, column show/hide, sorting, global search, presets, and CSV export are explicitly in later phases according to the roadmap.

</domain>

<decisions>

## Implementation Decisions

### Access + navigation

- **D-01:** Reports lives at **`/dashboard/reports`** and is shown in the navigation only for the roles **admin** and **instructor**.

### Date range + timezone

- **D-02:** Default date range on open: **the last 30 days**.
- **D-03:** The date range is always interpreted in **Europe/Stockholm** (the club's local time).
- **D-04:** From/to are **inclusive full days**: from = 00:00:00.000 and to = 23:59:59.999 in Europe/Stockholm.
- **D-05:** The UI sends dates as **date-only** strings: **`YYYY-MM-DD`**.

### Raw table (v1) — row definition + columns

- **D-06:** A row in the raw table corresponds to **one `Attendance` record**.
- **D-07:** Columns in Phase 1 (without toggles):
  - Date (local)
  - Start time / end time (from the session/schedule)
  - Student (name)
  - Class (name)
  - Instructor
  - Status (present/absent/late/excused)
  - Category
  - Note (notes)
  - Recorded by (recorded_by)
  - Recorded at (recorded_at)

### Filter UX (v1)

- **D-08:** The date range can always be chosen (from–to) and is the primary scope.
- **D-09:** The student filter supports **both**:
  - Dropdown (searchable) for exact selection
  - Free text (contains) on the student name
- **D-10:** Class/session filtering is done via a **dropdown on session/schedule (`class schedule`)**.
- **D-11:** The session/schedule dropdown is **limited to sessions within the selected date range**.
- **D-12:** The instructor filter is a **dropdown** (values are fetched/derived from classes).
- **D-13:** The status filter is **multi-select** (multiple statuses at the same time).

### Pagination (v1)

- **D-14:** Server-side pagination with default **pageSize = 25**.
- **D-15:** The API response includes **total** so the UI can show page count/“X of Y”.

### Report-API shape

- **D-16:** New dedicated endpoint: **`POST /api/reports/attendance/raw`** with the query in the request body.

### the agent's Discretion

- Exact layout/placement of the filter controls (within the boundaries above)
- Exact request/response DTO names and validation details (as long as the semantics match)
- How dropdown data is loaded (e.g. separate list endpoints vs reuse of existing ones)

</decisions>

<specifics>

## Specific Ideas

- No additional specific UI references — a standard shadcn/ui table + filter row is fine.

</specifics>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope

- `.planning/ROADMAP.md` — phase boundary + success criteria for Phase 1
- `.planning/REQUIREMENTS.md` — SEC-01, SEC-02, RPT-02, QRY-01, QRY-02, QRY-05
- `.planning/PROJECT.md` — overall goal and constraints (minimize new deps, teacher-friendly)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Backend RBAC: `authenticate` + `authorize(...)` in `src/middleware/auth.ts`.
- Frontend nav: role filtering in `frontend/src/components/layouts/DashboardLayout.tsx`.

### Established Patterns

- Backend layering: routes → controllers → services → models.
- Authenticated backend routes are mounted under `src/index.ts` with `authenticate` on the route group.

### Integration Points

- There is already an older report route: `GET /api/attendance/reports/:dateRange` that uses `AttendanceService.generateAttendanceReports(dateRange)` (aggregation per student). It does not meet the Phase 1 requirements (from–to, pagination, raw rows) and should **not** be reused for the new Reports page.

</code_context>

<deferred>

## Deferred Ideas

- Aggregated mode + key metrics (Phase 2)
- Column show/hide, sorting, global free-text search (Phase 3)
- Presets (private + shared) (Phase 4)
- CSV export (streaming + safe) (Phase 5)
- “Instructor only sees their own sessions” (SECX-01 / v2)

</deferred>

---

*Phase: 01-secure-raw-reporting*
*Context gathered: 2026-04-13*
