# Phase 1 / Plan 01-02 — Frontend: Reports (Raw)

**Date:** 2026-04-13

## What shipped

- Reports page: `/dashboard/reports`
- Reports link in the dashboard nav for the roles **admin** and **instructor**
- Filters + raw table (one row per attendance) + server-side pagination

## Files

- Navigation:
  - `frontend/src/components/layouts/DashboardLayout.tsx`
- Reports UI:
  - `frontend/src/app/dashboard/reports/page.tsx`

## Verification

- Automated smoke checks:
  - Prod start via PM2 (backend 4010 + frontend 4011)
  - `GET /api/auth/session` responds from NextAuth (i.e. the proxy does not intercept `/api/auth/*`)
  - `POST /api/reports/attendance/raw` is proxied to the backend and returns JSON (e.g. 401 when unauthenticated)

## Notes

- The full manual visual/UX verification flow (log in → open Reports → click around) is not logged here, but the page and proxy are functionally “wired” and runnable in prod mode.
