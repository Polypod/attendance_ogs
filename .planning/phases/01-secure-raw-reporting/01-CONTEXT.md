# Phase 1: Secure Raw Reporting - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Den här fasen levererar en ny Reports-sida i dashboarden samt ett nytt report-API för **rådata** (en rad per närvaro-registrering) med:
- RBAC (endast ADMIN + INSTRUCTOR)
- Datumintervall (från–till) med tydlig tidszonsregel
- Fältfilter (minst student, instruktör, klass/pass, status)
- Server-side paginering

Aggregeringar, kolumn-visa/dölj, sortering, global sök, presets och CSV-export ligger uttryckligen i senare faser enligt roadmap.

</domain>

<decisions>
## Implementation Decisions

### Access + navigation
- **D-01:** Reports ligger på **`/dashboard/reports`** och visas i navigationen endast för rollerna **admin** och **instructor**.

### Datumintervall + tidszon
- **D-02:** Default datumintervall vid öppning: **senaste 30 dagarna**.
- **D-03:** Datumintervall tolkas alltid i **Europe/Stockholm** (klubbens lokala tid).
- **D-04:** Från/till är **inklusiva hela dagar**: från = 00:00:00.000 och till = 23:59:59.999 i Europe/Stockholm.
- **D-05:** UI skickar datum som **date-only** strängar: **`YYYY-MM-DD`**.

### Råtabell (v1) — raddefinition + kolumner
- **D-06:** En rad i råtabellen motsvarar **en `Attendance`-record**.
- **D-07:** Kolumner i Phase 1 (utan toggles):
  - Datum (lokalt)
  - Starttid / sluttid (från pass/schema)
  - Student (namn)
  - Klass (namn)
  - Instruktör
  - Status (present/absent/late/excused)
  - Kategori
  - Anteckning (notes)
  - Registrerad av (recorded_by)
  - Registrerad vid (recorded_at)

### Filter-UX (v1)
- **D-08:** Datumintervall är alltid möjligt att välja (från–till) och är den primära avgränsningen.
- **D-09:** Student-filter stödjer **både**:
  - Dropdown (sökbar) för exakt val
  - Fri-text (contains) på studentnamn
- **D-10:** Klass/pass-filter sker via **dropdown på pass/schema (`class schedule`)**.
- **D-11:** Pass/schema-dropdown **begränsas till pass inom valt datumintervall**.
- **D-12:** Instruktör-filter är en **dropdown** (värden hämtas/deriveras från klasser).
- **D-13:** Status-filter är **multi-select** (flera status samtidigt).

### Paginering (v1)
- **D-14:** Server-side paginering med default **pageSize = 25**.
- **D-15:** API-respons inkluderar **total** så UI kan visa sidantal/”X av Y”.

### Report-API shape
- **D-16:** Ny dedikerad endpoint: **`POST /api/reports/attendance/raw`** med query i request-body.

### the agent's Discretion
- Exakt layout/placering av filterkontroller (inom ramarna ovan)
- Exakt request/response DTO-namn och valideringsdetaljer (så länge semantics matchar)
- Hur dropdown-data laddas (t.ex. separata list-endpoints vs återanvändning av befintliga)

</decisions>

<specifics>
## Specific Ideas

- Inga ytterligare specifika UI-referenser — standard shadcn/ui-tabell + filterrad är ok.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/ROADMAP.md` — fasgräns + success criteria för Phase 1
- `.planning/REQUIREMENTS.md` — SEC-01, SEC-02, RPT-02, QRY-01, QRY-02, QRY-05
- `.planning/PROJECT.md` — helhetsmål och constraints (minimera nya deps, teacher-friendly)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Backend RBAC: `authenticate` + `authorize(...)` i `src/middleware/auth.ts`.
- Frontend nav: rollfiltrering i `frontend/src/components/layouts/DashboardLayout.tsx`.

### Established Patterns
- Backend layering: routes → controllers → services → models.
- Autentiserade backend-routes mountas under `src/index.ts` med `authenticate` på route-gruppen.

### Integration Points
- Det finns redan en äldre report-route: `GET /api/attendance/reports/:dateRange` som använder `AttendanceService.generateAttendanceReports(dateRange)` (agg per student). Den uppfyller inte Phase 1-kraven (från–till, paginering, raw rows) och ska **inte** återanvändas för nya Reports-sidan.

</code_context>

<deferred>
## Deferred Ideas

- Aggregerat läge + nyckeltal (Phase 2)
- Kolumn visa/dölj, sortering, global fri-text-sök (Phase 3)
- Presets (privata + delade) (Phase 4)
- CSV-export (streaming + safe) (Phase 5)
- “Instruktör ser bara egna pass” (SECX-01 / v2)

</deferred>

---

*Phase: 01-secure-raw-reporting*
*Context gathered: 2026-04-13*
