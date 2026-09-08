# Phase 1: Secure Raw Reporting - Research

**Researched:** 2026-04-13
**Domain:** Express + Mongoose reporting query (raw rows) + Next.js/shadcn UI table
**Confidence:** MEDIUM

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Reports page: `/dashboard/reports` and only **admin + instructor** in the nav
- Default date range: the last 30 days
- Timezone rule: **Europe/Stockholm**, date-only `YYYY-MM-DD`, inclusive full days
- Raw rows: 1 row per `Attendance`
- Columns in Phase 1: date (local), start/end (schedule), student, class, instructor, status, category, notes, recorded_by, recorded_at
- Filter UX: student (dropdown + free-text contains), schedule dropdown (limited to the date range), instructor dropdown, status multi-select
- Pagination: server-side, pageSize=25, response with total
- API: new endpoint `POST /api/reports/attendance/raw` with query body

### the agent's Discretion

- Exact layout and component choices (shadcn) for the filter row + table
- Exact DTO names and validation details
- How dropdown data is loaded (reuse existing endpoints vs new lightweight list endpoints)

### Deferred Ideas (OUT OF SCOPE)

- Aggregated mode + key metrics (Phase 2)
- Column toggle/sort/global search (Phase 3)
- Presets (Phase 4)
- CSV export (Phase 5)

## Summary

Phase 1 needs a “raw data” API that can filter and paginate stably over `Attendance` while allowing the UI to show enriched fields (student name, class name, start/end). In this codebase there are already patterns for RBAC (`authorize`) and for populating relations in services, but there is currently no endpoint that matches the requirements (from–to, field filters, pagination, raw rows).

The most robust backend approach is a **Mongoose aggregate pipeline** with `$match` (date + filters), `$lookup`/`$unwind` to students/schedules/classes, and a `$facet` for `{ items, total }` in a single call. That provides both pagination and total without a double query.

**Primary recommendation:** Implement `POST /api/reports/attendance/raw` as aggregate + `$facet`, and implement Stockholm day boundaries explicitly (preferably with a small tz-helper or `moment-timezone`).

## Architecture Patterns

### Recommended structure (aligned with the repo)

- `src/routes/reportRoutes.ts` → HTTP routes
- `src/controllers/ReportController.ts` → request/response
- `src/services/ReportService.ts` → query + aggregation + Mongoose
- `src/middleware/validation.ts` + Joi schema → request validation

### Data-join strategy (raw rows)

- Base: `AttendanceModel`
- Join: `students` (for student name)
- Join: `classschedules` + `classes` (for class name + instructor + start/end)

### Pagination + total (Mongo)

- `$facet: { items: [..$skip,$limit..], total: [{$count:"count"}] }`

## Common Pitfalls

### Pitfall: Timezone drift between UI/Backend

- **What goes wrong:** date-only is interpreted as UTC in Node (`new Date("YYYY-MM-DD")`), which can shift the day during DST or if the server runs in another TZ.
- **Avoid:** Convert `YYYY-MM-DD` → UTC boundaries for **Europe/Stockholm** explicitly. Alternatively: document and force the server process to `TZ=Europe/Stockholm` (less robust in deployment).

### Pitfall: Unstable pagination

- **What goes wrong:** If the sort is not deterministic, pagination can “jump”.
- **Avoid:** Stable default sort, e.g. `date desc, recorded_at desc, _id desc`.

### Pitfall: Dropdown data gets too heavy

- **What goes wrong:** `GET /api/students` currently returns all fields for all students without paging.
- **Avoid:** Either (a) create lightweight list endpoints (id+name) with search/paging, or (b) make the dropdown a server-side search.

## Repo-specific notes

- Existing older report endpoint: `GET /api/attendance/reports/:dateRange` + `AttendanceService.generateAttendanceReports(dateRange)` (aggregation per student for week/month/quarter). It does not match Phase 1.
- `GET /api/schedules?startDate&endDate` exists and populates `class_id` (name/instructor/categories). NOTE: it uses `new Date(startDate)` which interprets date-only as UTC.
- Frontend role-based nav: `frontend/src/components/layouts/DashboardLayout.tsx`.

## Open Questions

1. **Tz implementation without a new dependency?**
   - Rec: use a small tz-lib (`moment-timezone`) or an internal helper based on `Intl`.
   - During execution: choose the simplest option that gives correct DST behavior in Stockholm.

2. **Instructor source for the raw table:**
   - `Class.instructor` is stable and simple.
   - `ClassSchedule.sessions` appears to have inconsistency (`S-instructor` vs `instructor`) → should not be the “source of truth” in Phase 1.

## Sources

- Codebase inspection (routes/controllers/services/models) in this repo.
