# Project Research Summary

**Project:** Attendance OGS
**Domain:** Rapporterings-UI (rådata + aggregerat) med presets och CSV-export för närvarosystem
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Executive Summary

Det här arbetet gäller en “konfigurerbar rapporttabell” i dashboarden för admin och instruktörer: samma vy ska kunna visa både rådata (en rad per närvaro-registrering) och aggregerade sammanställningar (standard-grupperingar) med filter, sortering, kolumnhantering, sparade vyer/presets och CSV-export. Den stabila kärnan är ett tydligt backend-kontrakt (query-DSL + whitelist), så att UI, export och aggregeringar alltid tolkar filter/sort/kolumner på samma sätt.

Rekommenderad implementation är att bygga rapportsidan kring TanStack Table (headless “table engine”) och shadcn/ui-komponenter i frontend, men köra filtrering/sortering/paginering och aggregeringar server-side i Express/Mongoose via aggregation pipelines. CSV-export ska vara ett separat backend-endpoint som streamar hela det filtrerade resultatet (inte “current page”) och som använder samma query-builder som tabellen.

Största riskerna är (1) otydlig rapportsemantik (”vad betyder siffran?”), (2) tidszon/off-by-one i datumintervall, (3) att UI och backend driver isär (mismatch mellan vad UI tillåter och vad backend faktiskt stödjer), samt (4) att presets blir sköra utan schema-version + validering/migration. Dessa hanteras genom att tidigt definiera report contract + canonical datumintervall-regel, bygga en whitelistad query-DSL med Joi-validering, och versionera preset-state.

## Key Findings

### Recommended Stack

Stacken kan hållas helt inom befintlig repo: Next.js App Router + React + shadcn/ui i frontend och Express + Mongoose i backend. För tabellfunktionalitet rekommenderas TanStack Table v8 (shadcn Data Table-guiden är byggd runt detta), med optional `@tanstack/react-virtual` om rådata kan bli stora mängder. För export rekommenderas server-side streaming CSV med `csv-stringify`.

**Core technologies:**

- Next.js (App Router): rapportsida UI — redan i repo och passar dashboard-strukturen.
- React: kontrollerad tabell-state (filter/sort/kolumner/presets) — redan i repo.
- shadcn/ui (Radix + Tailwind): UI-primitiver för tabell/controls — konsekvent med övriga appen.
- TanStack Table (`@tanstack/react-table`): tabellmotor (sorting/filtering/visibility/pagination, controlled/manual) — headless och flexibel.
- Express + Mongoose: rapport-API, preset-persistens och export — följer repo-lager (routes → controllers → services → models).

### Expected Features

Funktionerna som uppfattas som “måste” för att rapportsidan ska kännas komplett är: två lägen (rådata + aggregerat), datumintervall, fältfilter, sortering, kolumn visa/dölj, server-side paginering, presets (privata + delade) och CSV-export som matchar “synliga värden” och exporterar hela filtrerade datasetet.

**Must have (table stakes):**

- Rådata + aggregerat läge — både detaljgranskning och överblick.
- Datumintervall-filter — central för rapporter (med tydlig tidszonsregel).
- Kolumnfilter + sortering — standardbeteende i rapporttabeller.
- Kolumnhantering (visa/dölj, ev. ordning) — och ska påverka export.
- Server-side paginering — dataset blir snabbt stora.
- Presets (privata + delade) — återanvändning och teamstandard.
- CSV-export av hela filtrerade resultatet med aktiva kolumner — praktiskt workflow.

**Should have (competitive):**

- Drill-down från agg → rådata (agg-rad genererar motsvarande rådata-filter) — bygger förtroende.
- Snabbfilterchips (”senaste 7 dagar”, ”endast frånvaro”) — friktion bort.
- ”Explain this number” (definition av nyckeltal + aktiva filter) — minskar tolkningstvister.

**Defer (v2+):**

- Pivot-/BI-byggare och diagram/dashboards — scope-explosion.
- Excel (XLSX) / PDF-export — CSV räcker initialt.
- Fri group-by (“semi-pivot”) — först när standardgrupperingar inte räcker.

### Architecture Approach

Arkitekturen bör spegla befintlig clean architecture: nya routes/controllers för reports och presets, ett `ReportService` som bygger whitelists + aggregation pipelines ($match tidigt, $lookup där behövs, $facet för `items + total`), och ett `ReportPresetService` + `ReportPreset`-model för persistens och access policy.

**Major components:**

1. **ReportsPage (Next.js client)** — state för mode (raw/agg), filter/sort/kolumner, presets, export.
2. **ReportController + ReportService (Express)** — validerar DTO, bygger pipeline, returnerar `{ items, total }`.
3. **ReportPresetController + ReportPresetService + ReportPreset model** — CRUD presets + policy (privat/delad, admin-regler).

### Critical Pitfalls

1. **Otydlig rapportsemantik (”vad betyder siffran?”)** — definiera report contract (mått/nyckeltal/tidszon) och visa definition i UI.
2. **Tidszon/off-by-one i datumintervall** — canonical representation + intervall $[from,to)$ och regressionstester (midnatt/DST).
3. **UI/backend mismatch i filter/sort/kolumner** — whitelistad query-DSL + Joi-validering + konsekventa 400-fel.
4. **Presets utan `schemaVersion`/migration** — versionera preset-state, validera vid load och migrera best-effort.
5. **Export implementeras som “current page” eller utan streaming** — separat export-endpoint, streama cursor, respektera backpressure.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Report Contract & Semantik (R1)

**Rationale:** Allt annat (agg, export, presets) blir dyrt att göra om ifall definitioner/tidszon är oklara.
**Delivers:** Tydligt kontrakt för rapport: mode (raw/agg), dimensioner, nyckeltal, canonical datumintervall-regel, kolumn- och filter-whitelists.
**Addresses:** Datumintervall, standard-grupperingar, grundnyckeltal.
**Avoids:** Semantik-misstro och tidszonsbuggar.

### Phase 2: Backend Query Engine + Säkerhet (R2)

**Rationale:** UI ska inte bära filtrering/sortering för stora dataset; backend måste vara källan till sanning och säkert byggd.
**Delivers:** `POST /api/reports/query` med server-side filtering/sorting/pagination och agg-varianten med standard-grupperingar. Joi-validering och RBAC (`ADMIN`, `INSTRUCTOR`). Index-plan för vanligaste filter.
**Uses:** Express + Mongoose aggregation + `$facet`.
**Implements:** Whitelistad query-DSL → pipeline builder.

### Phase 3: Presets (Persistens + Delning) (R3)

**Rationale:** Presets är central UX och bäst att få på plats tidigt, men måste vara robust (policy + versionering).
**Delivers:** `ReportPreset`-model + CRUD endpoints, access policy (owner vs shared; delade rekommenderat admin-only för ändring), `schemaVersion` + validering/migration vid load.
**Addresses:** Privata + delade presets.
**Avoids:** Sköra presets och IDOR/behörighetsproblem.

### Phase 4: UI — Tabell + State (R4)

**Rationale:** När backend-kontrakt och presets finns kan UI implementeras som kontrollerad state-maskin utan omtag.
**Delivers:** ReportsPage med två lägen (rå/agg), filter/sort/kolumnvisa/dölj, paginering, preset-meny. TanStack Table i controlled/manual mode. Touch-vänliga kontroller.
**Addresses:** “Teacher-friendly” UX, tomlägen, laddningstillstånd.
**Avoids:** Klient-side “hämta allt och filtrera” anti-pattern.

### Phase 5: Export — CSV (Streaming + Säkerhet) (R5)

**Rationale:** Export är ett primärt workflow och måste matcha vyn exakt, samt skala utan OOM/timeouts.
**Delivers:** `POST /api/reports/export` som streamar hela filtrerade resultatet med aktiva kolumner. CSV-injection-mitigering (Excel/Sheets) och robust streaming (backpressure).
**Addresses:** CSV-export av “synliga värden” och hela filtrerade datasetet.
**Avoids:** Export=current-page, OOM/timeouts, CSV-formelinjektion.

### Phase 6: Verifiering & Hårdning (R6)

**Rationale:** Rapporter tappar snabbt förtroende om de är långsamma eller inkorrekta vid gränsfall.
**Delivers:** Service-layer tester för query/pipelines (inkl. datumgränser), prestandamätning (p95) för agg, indexverifiering, regressionstest att tabell och export ger samma totals.
**Addresses:** Korrekthet, stabilitet och skala.
**Avoids:** Dyra aggregeringar och “looks done but isn’t”.

### Phase Ordering Rationale

- Kontrakt/semantik/tidszon måste vara först (annars omtag i agg/export/presets).
- Backend query engine före UI för att undvika dubbelimplementerad logik och mismatch.
- Presets tidigt, men med versionering/policy från start.
- CSV export efter att query-DSL/pipeline är stabil, så export delar exakt samma builder.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Backend query + säkerhet):** exakt whitelist/DSL-design (vilka filter/ops), indexering, samt hur global search ska avgränsas utan full scans.
- **Phase 5 (CSV export):** streaming genom eventuell reverse proxy (timeouts/buffering), samt robust backpressure-hantering och CSV-injection-sanitization policy.

Phases with standard patterns (skip research-phase):

- **Phase 4 (UI tabell/state):** TanStack Table + shadcn Data Table-mönster är väldokumenterat.
- **Phase 3 (Presets CRUD):** klassisk Mongoose CRUD + RBAC/policy.

## Confidence Assessment

| Area | Confidence | Notes |
| ---- | ---------- | ----- |
| Stack | MEDIUM | Bygger på repo-kontext + etablerade guider (shadcn/TanStack), men React 19 peer deps bör verifieras vid install. |
| Features | MEDIUM | Tydligt från PROJECT.md + branschmönster; exakta “nyckeltal” kan kräva domänbeslut. |
| Architecture | MEDIUM | Följer repo:s lager/patterns och Mongo aggregation best practice; detaljer i pipeline/lookup kräver implementationstest. |
| Pitfalls | MEDIUM | Stöd från OWASP/Node/Mongo docs + domänspecifika erfarenheter; behöver konkret verifiering i appen. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Canonical datum/tidszon-regel:** måste beslutas explicit (serverzon vs användarzon) och testas (DST/midnatt).
- **Global search scope & prestanda:** definiera exakt fält (student/class/instructor) och hur sök byggs utan dyra regex över joinade fält.
- **Aggregeringsdefinitioner:** bekräfta vilka statusar som räknas som “närvarande” och hur totals ska visas i agg-läge.
- **Preset-migration:** definiera minsta `schemaVersion`-strategi och vad som händer när en kolumn tas bort/ändras.

## Sources

### Primary (HIGH confidence)

- <https://ui.shadcn.com/docs/components/data-table> — mönster för TanStack Table + shadcn table UI.
- <https://tanstack.com/table/latest> — tabellfunktioner och controlled/manual patterns.
- <https://nodejs.org/api/stream.html> — streaming/backpressure och pipeline.
- <https://owasp.org/www-community/attacks/CSV_Injection> — CSV/formula injection och mitigations.
- <https://www.mongodb.com/docs/manual/core/aggregation-pipeline/> — aggregation pipeline best practice.

### Secondary (MEDIUM confidence)

- <https://csv.js.org/stringify/> — server-side CSV generation (streaming).
- <https://mongoosejs.com/docs/api/aggregate.html> — aggregation cursors i Mongoose.
- <https://nextjs.org/docs/app> — App Router patterns.
- .planning/research/STACK.md — stackval och alternativ.
- .planning/research/FEATURES.md — feature-prioritering och MVP.
- .planning/research/ARCHITECTURE.md — rekommenderad modulstruktur + endpoint-förslag.
- .planning/research/PITFALLS.md — risker och prevention per fas.
- .planning/PROJECT.md — scope och constraints för rapportsidan.

---
*Research completed: 2026-04-13*
*Ready for roadmap: yes*
