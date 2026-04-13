# Phase 1 / Plan 01-02 — Frontend: Reports (Raw)

**Date:** 2026-04-13

## What shipped
- Reports-sida: `/dashboard/reports`
- Reports-länk i dashboard-nav för rollerna **admin** och **instructor**
- Filter + råtabell (en rad per attendance) + server-side paginering

## Files
- Navigation:
  - `frontend/src/components/layouts/DashboardLayout.tsx`
- Reports UI:
  - `frontend/src/app/dashboard/reports/page.tsx`

## Verification
- Automated smoke checks:
  - Prod-start via PM2 (backend 4010 + frontend 4011)
  - `GET /api/auth/session` svarar från NextAuth (dvs proxy interceptar inte `/api/auth/*`)
  - `POST /api/reports/attendance/raw` proxas till backend och returnerar JSON (t.ex. 401 när oautentiserad)

## Notes
- Den manuella visuella/verifieringen av hela UX-flödet (logga in → öppna Reports → klicka runt) är inte loggad här, men sidan och proxyn är funktionellt “wired” och körbar i prod-läge.
