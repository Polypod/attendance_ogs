# Phase 1: Secure Raw Reporting - Research

**Researched:** 2026-04-13
**Domain:** Express + Mongoose reporting query (raw rows) + Next.js/shadcn UI table
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reports sida: `/dashboard/reports` och bara **admin + instructor** i nav
- Datumintervall default: senaste 30 dagar
- Tidszonregel: **Europe/Stockholm**, date-only `YYYY-MM-DD`, inklusiva hela dagar
- Raw rows: 1 rad per `Attendance`
- Kolumner i Phase 1: datum (lokalt), start/end (schema), student, klass, instruktör, status, kategori, notes, recorded_by, recorded_at
- Filter-UX: student (dropdown + fri-text contains), schema dropdown (begränsad till datumintervall), instruktör dropdown, status multi-select
- Paginering: server-side, pageSize=25, respons med total
- API: ny endpoint `POST /api/reports/attendance/raw` med query-body

### the agent's Discretion
- Exakt layout och komponentval (shadcn) för filterrad + tabell
- Exakta DTO-namn och valideringsdetaljer
- Hur dropdown-data laddas (återanvänd befintliga endpoints vs nya lätta list-endpoints)

### Deferred Ideas (OUT OF SCOPE)
- Aggregerat läge + nyckeltal (Phase 2)
- Kolumn-toggle/sort/global search (Phase 3)
- Presets (Phase 4)
- CSV-export (Phase 5)

</user_constraints>

<research_summary>
## Summary

Phase 1 behöver ett “rådata”-API som kan filtrera och paginera stabilt över `Attendance` samtidigt som UI kan visa berikade fält (studentnamn, klassnamn, start/end). I den här kodbasen finns redan mönster för RBAC (`authorize`) och för att populera relationer i services, men det saknas idag ett endpoint som matchar kraven (från–till, fältfilter, paginering, raw rows).

Den mest robusta backend-approachen är en **Mongoose aggregate-pipeline** med `$match` (datum + filter), `$lookup`/`$unwind` till students/schedules/classes och en `$facet` för `{ items, total }` i ett anrop. Det ger både paginering och total utan dubbel query.

**Primary recommendation:** Implementera `POST /api/reports/attendance/raw` som aggregate + `$facet`, och implementera Stockholm-daggränser explicit (helst med liten tz-helper eller `moment-timezone`).

</research_summary>

<architecture_patterns>
## Architecture Patterns

### Rekommenderad struktur (i linje med repo)
- `src/routes/reportRoutes.ts` → HTTP routes
- `src/controllers/ReportController.ts` → request/response
- `src/services/ReportService.ts` → query + aggregation + Mongoose
- `src/middleware/validation.ts` + Joi schema → requestvalidering

### Data-join strategi (raw rows)
- Bas: `AttendanceModel`
- Join: `students` (för studentnamn)
- Join: `classschedules` + `classes` (för klassnamn + instruktör + start/end)

### Paginering + total (Mongo)
- `$facet: { items: [..$skip,$limit..], total: [{$count:"count"}] }`

</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Pitfall: Timezone drift mellan UI/Backend
- **Vad går fel:** date-only tolkas som UTC i Node (`new Date("YYYY-MM-DD")`), vilket kan förskjuta dag vid DST eller om servern kör annan TZ.
- **Undvik:** Konvertera `YYYY-MM-DD` → UTC boundaries för **Europe/Stockholm** explicit. Alternativt: dokumentera och tvinga serverprocess `TZ=Europe/Stockholm` (mindre robust vid deploy).

### Pitfall: O-stabil paginering
- **Vad går fel:** Om sort inte är deterministisk kan pagination “hoppa”.
- **Undvik:** Stabil default-sort, t.ex. `date desc, recorded_at desc, _id desc`.

### Pitfall: Dropdown-data blir för tungt
- **Vad går fel:** `GET /api/students` returnerar idag alla fält för alla students utan paging.
- **Undvik:** Antingen (a) skapa lightweight list-endpoints (id+name) med search/paging, eller (b) gör dropdown som server-side search.

</common_pitfalls>

<code_context>
## Repo-specific notes

- Befintlig äldre report-endpoint: `GET /api/attendance/reports/:dateRange` + `AttendanceService.generateAttendanceReports(dateRange)` (agg per student för week/month/quarter). Den matchar inte Phase 1.
- `GET /api/schedules?startDate&endDate` finns och populera `class_id` (name/instructor/categories). OBS: använder `new Date(startDate)` vilket tolkar date-only som UTC.
- Frontend rollbaserad nav: `frontend/src/components/layouts/DashboardLayout.tsx`.

</code_context>

<open_questions>
## Open Questions

1. **Tz-implementation utan ny dependency?**
   - Rek: använd liten tz-lib (`moment-timezone`) eller en intern helper baserad på `Intl`.
   - Under execution: välj den enklaste som ger korrekt DST i Stockholm.

2. **Instruktör-källa för råtabell:**
   - `Class.instructor` är stabil och enkel.
   - `ClassSchedule.sessions` verkar ha inkonsekvens (`S-instructor` vs `instructor`) → bör inte vara “source of truth” i Phase 1.

</open_questions>

<sources>
## Sources

- Codebase inspection (routes/controllers/services/models) i detta repo.

</sources>
