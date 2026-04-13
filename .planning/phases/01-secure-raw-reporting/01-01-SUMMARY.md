# Phase 1 / Plan 01-01 — Backend: Raw Attendance Report API

**Date:** 2026-04-13

## What shipped
- Nytt rapport-API för rådata: `POST /api/reports/attendance/raw`
- RBAC: endast **ADMIN** och **INSTRUCTOR** (autentiserad men fel roll ⇒ 403)
- Datumintervall `from/to` som date-only (`YYYY-MM-DD`) tolkas som **inklusive Stockholm-dagar** (Europe/Stockholm)
- Server-side paginering med stabil sort

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
  - Jest tests för service + controller (RBAC, datumintervall, paginering)
- Smoke:
  - API nås via frontend-proxy i prod-läge och returnerar JSON (t.ex. 401 när oautentiserad)

## Notes
- Fokus i denna plan är rådata (en rad per `Attendance`). Aggregering och UI-tabell tillhör andra planer/faser.
