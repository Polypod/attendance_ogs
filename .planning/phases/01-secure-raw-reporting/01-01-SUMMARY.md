# Phase 1 / Plan 01-01 — Backend: Raw Attendance Report API

**Date:** 2026-04-13

## What shipped

- New report API for raw data: `POST /api/reports/attendance/raw`
- RBAC: only **ADMIN** and **INSTRUCTOR** (authenticated but wrong role ⇒ 403)
- Date range `from/to` as date-only (`YYYY-MM-DD`) is interpreted as **inclusive Stockholm days** (Europe/Stockholm)
- Server-side pagination with stable sorting

## Files

- Backend route/controller/service:
  - `src/routes/reportRoutes.ts`
  - `src/controllers/ReportController.ts`
  - `src/services/ReportService.ts`
  - `src/index.ts` (mount under `/api/reports`)
- Validation:
  - `src/types/validation.ts`
  - `src/middleware/validation.ts`
- Tests:
  - `src/__tests__/services/ReportService.test.ts`
  - `src/__tests__/controllers/ReportController.test.ts`

## Verification

- Automated:
  - Jest tests for service + controller (RBAC, date range, pagination)
- Smoke:
  - API is reachable via the frontend proxy in prod mode and returns JSON (e.g. 401 when unauthenticated)

## Notes

- The focus of this plan is raw data (one row per `Attendance`). Aggregation and the UI table belong to other plans/phases.
