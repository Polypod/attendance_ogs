# Project Research Summary

**Project:** Attendance OGS
**Domain:** Reporting UI (raw data + aggregated) with presets and CSV export for attendance system
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Executive Summary

This work concerns a “configurable reporting table” in the dashboard for admins and instructors: the same view should be able to show both raw data (one row per attendance registration) and aggregated summaries (standard groupings) with filters, sorting, column management, saved views/presets, and CSV export. The stable core is a clear backend contract (query DSL + whitelist), so the UI, export, and aggregations always interpret filters/sort/columns the same way.

The recommended implementation is to build the reports page around TanStack Table (headless “table engine”) and shadcn/ui components in the frontend, while running filtering/sorting/pagination and aggregations server-side in Express/Mongoose via aggregation pipelines. CSV export should be a separate backend endpoint that streams the full filtered result set (not the “current page”) and uses the same query builder as the table.

The biggest risks are (1) unclear report semantics (“what does the number mean?”), (2) time zone/off-by-one errors in date ranges, (3) the UI and backend drifting apart (mismatch between what the UI allows and what the backend actually supports), and (4) presets becoming fragile without schema version + validation/migration. These are handled by defining the report contract + canonical date-range rule early, building a whitelisted query DSL with Joi validation, and versioning preset state.

## Key Findings

### Recommended Stack

The stack can stay entirely within the existing repo: Next.js App Router + React + shadcn/ui in the frontend and Express + Mongoose in the backend. For table functionality, TanStack Table v8 is recommended (the shadcn Data Table guide is built around it), with optional `@tanstack/react-virtual` if raw data may become large. For export, server-side streaming CSV with `csv-stringify` is recommended.

**Core technologies:**

- Next.js (App Router): reports page UI — already in the repo and fits the dashboard structure.
- React: controlled table state (filters/sort/columns/presets) — already in the repo.
- shadcn/ui (Radix + Tailwind): UI primitives for table/controls — consistent with the rest of the app.
- TanStack Table (`@tanstack/react-table`): table engine (sorting/filtering/visibility/pagination, controlled/manual) — headless and flexible.
- Express + Mongoose: reporting API, preset persistence, and export — follows the repo layering (routes → controllers → services → models).

### Expected Features

The features that feel like “must-haves” for the reports page to feel complete are: two modes (raw data + aggregated), date range, field filters, sorting, column show/hide, server-side pagination, presets (private + shared), and CSV export that matches “visible values” and exports the full filtered dataset.

**Must have (table stakes):**

- Raw data + aggregated mode — both detailed inspection and high-level overview.
- Date range filter — central to reporting (with a clear time zone rule).
- Column filters + sorting — standard behavior in reporting tables.
- Column management (show/hide, possibly order) — and it should affect export.
- Server-side pagination — datasets become large quickly.
- Presets (private + shared) — reuse and team standardization.
- CSV export of the full filtered result with active columns — practical workflow.

**Should have (competitive):**

- Drill-down from agg → raw data (agg row generates corresponding raw-data filter) — builds trust.
- Quick filter chips (“last 7 days”, “absence only”) — lower friction.
- “Explain this number” (definition of metrics + active filters) — reduces interpretation disputes.

**Defer (v2+):**

- Pivot/BI builder and charts/dashboards — scope explosion.
- Excel (XLSX) / PDF export — CSV is enough initially.
- Free-form group-by (“semi-pivot”) — only once standard groupings are no longer enough.

### Architecture Approach

The architecture should mirror the existing clean architecture: new routes/controllers for reports and presets, a `ReportService` that builds whitelists + aggregation pipelines (`$match` early, `$lookup` where needed, `$facet` for `items + total`), and a `ReportPresetService` + `ReportPreset` model for persistence and access policy.

**Major components:**

1. **ReportsPage (Next.js client)** — state for mode (raw/agg), filters/sort/columns, presets, export.
2. **ReportController + ReportService (Express)** — validates DTO, builds pipeline, returns `{ items, total }`.
3. **ReportPresetController + ReportPresetService + ReportPreset model** — CRUD presets + policy (private/shared, admin rules).

### Critical Pitfalls

1. **Unclear report semantics (“what does the number mean?”)** — define the report contract (measures/metrics/time zone) and show the definition in the UI.
2. **Time zone/off-by-one in date ranges** — canonical representation + interval $[from,to)$ and regression tests (midnight/DST).
3. **UI/backend mismatch in filters/sort/columns** — whitelisted query DSL + Joi validation + consistent 400 errors.
4. **Presets without `schemaVersion`/migration** — version preset state, validate on load, and migrate best effort.
5. **Export implemented as “current page” or without streaming** — separate export endpoint, stream cursor, respect backpressure.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Report Contract & Semantics (R1)

**Rationale:** Everything else (agg, export, presets) becomes expensive to redo if definitions/time zone are unclear.
**Delivers:** Clear contract for reports: mode (raw/agg), dimensions, metrics, canonical date-range rule, column and filter whitelists.
**Addresses:** Date ranges, standard groupings, core metrics.
**Avoids:** Semantic mistrust and time zone bugs.

### Phase 2: Backend Query Engine + Security (R2)

**Rationale:** The UI should not own filtering/sorting for large datasets; the backend must be the source of truth and safely built.
**Delivers:** `POST /api/reports/query` with server-side filtering/sorting/pagination and the agg variant with standard groupings. Joi validation and RBAC (`ADMIN`, `INSTRUCTOR`). Index plan for common filters.
**Uses:** Express + Mongoose aggregation + `$facet`.
**Implements:** Whitelisted query DSL → pipeline builder.

### Phase 3: Presets (Persistence + Sharing) (R3)

**Rationale:** Presets are central UX and best added early, but they must be robust (policy + versioning).
**Delivers:** `ReportPreset` model + CRUD endpoints, access policy (owner vs shared; shared recommended as admin-only for editing), `schemaVersion` + validation/migration on load.
**Addresses:** Private + shared presets.
**Avoids:** Fragile presets and IDOR/authorization problems.

### Phase 4: UI — Table + State (R4)

**Rationale:** Once the backend contract and presets exist, the UI can be implemented as a controlled state machine without rework.
**Delivers:** ReportsPage with two modes (raw/agg), filter/sort/column show/hide, pagination, preset menu. TanStack Table in controlled/manual mode. Touch-friendly controls.
**Addresses:** “Teacher-friendly” UX, empty states, loading states.
**Avoids:** Client-side “fetch everything and filter” anti-pattern.

### Phase 5: Export — CSV (Streaming + Security) (R5)

**Rationale:** Export is a primary workflow and must match the view exactly, while scaling without OOM/timeouts.
**Delivers:** `POST /api/reports/export` that streams the full filtered result set with active columns. CSV injection mitigation (Excel/Sheets) and robust streaming (backpressure).
**Addresses:** CSV export of “visible values” and the full filtered dataset.
**Avoids:** Export=current-page, OOM/timeouts, CSV formula injection.

### Phase 6: Verification & Hardening (R6)

**Rationale:** Reports quickly lose trust if they are slow or incorrect at edge cases.
**Delivers:** Service-layer tests for query/pipelines (including date boundaries), performance measurement (p95) for agg, index verification, regression test that table and export produce the same totals.
**Addresses:** Correctness, stability, and scale.
**Avoids:** Expensive aggregations and “looks done but isn’t”.

### Phase Ordering Rationale

- Contract/semantics/time zone must come first (otherwise rework in agg/export/presets).
- Backend query engine before UI to avoid duplicated logic and mismatch.
- Presets early, but with versioning/policy from the start.
- CSV export after the query DSL/pipeline is stable, so export shares the exact same builder.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Backend query + security):** exact whitelist/DSL design (which filters/ops), indexing, and how global search should be bounded without full scans.
- **Phase 5 (CSV export):** streaming through any reverse proxy (timeouts/buffering), plus robust backpressure handling and CSV-injection sanitization policy.

Phases with standard patterns (skip research-phase):

- **Phase 4 (UI table/state):** TanStack Table + shadcn Data Table pattern is well documented.
- **Phase 3 (Presets CRUD):** classic Mongoose CRUD + RBAC/policy.

## Confidence Assessment

| Area | Confidence | Notes |
| ---- | ---------- | ----- |
| Stack | MEDIUM | Based on repo context + established guides (shadcn/TanStack), but React 19 peer deps should be verified at install time. |
| Features | MEDIUM | Clear from PROJECT.md + industry patterns; exact “metrics” may require domain decisions. |
| Architecture | MEDIUM | Follows the repo’s layering/patterns and Mongo aggregation best practice; pipeline/lookup details require implementation testing. |
| Pitfalls | MEDIUM | Supported by OWASP/Node/Mongo docs + domain-specific experience; needs concrete verification in the app. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Canonical date/time-zone rule:** must be decided explicitly (server zone vs user zone) and tested (DST/midnight).
- **Global search scope & performance:** define the exact fields (student/class/instructor) and how search is built without expensive regex across joined fields.
- **Aggregation definitions:** confirm which statuses count as “present” and how totals should be shown in agg mode.
- **Preset migration:** define the minimum `schemaVersion` strategy and what happens when a column is removed/changed.

## Sources

### Primary (HIGH confidence)

- <https://ui.shadcn.com/docs/components/data-table> — patterns for TanStack Table + shadcn table UI.
- <https://tanstack.com/table/latest> — table features and controlled/manual patterns.
- <https://nodejs.org/api/stream.html> — streaming/backpressure and pipeline.
- <https://owasp.org/www-community/attacks/CSV_Injection> — CSV/formula injection and mitigations.
- <https://www.mongodb.com/docs/manual/core/aggregation-pipeline/> — aggregation pipeline best practices.

### Secondary (MEDIUM confidence)

- <https://csv.js.org/stringify/> — server-side CSV generation (streaming).
- <https://mongoosejs.com/docs/api/aggregate.html> — aggregation cursors in Mongoose.
- <https://nextjs.org/docs/app> — App Router patterns.
- .planning/research/STACK.md — stack choices and alternatives.
- .planning/research/FEATURES.md — feature prioritization and MVP.
- .planning/research/ARCHITECTURE.md — recommended module structure + endpoint proposals.
- .planning/research/PITFALLS.md — risks and prevention by phase.
- .planning/PROJECT.md — scope and constraints for the reports page.

---
*Research completed: 2026-04-13*
*Ready for roadmap: yes*
