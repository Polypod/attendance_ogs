# Stack Research

**Domain:** Configurable reporting table (raw + aggregated) for attendance system
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
| ---------- | ------- | ------- | --------------- |
| Next.js (App Router) | 16.1.1 (repo) | Reporting page UI (interactive + authenticated) | Already in repo; App Router supports mixed server/client rendering and fits current dashboard structure. |
| React | 19.2.3 (repo) | UI state for filters/sorting/column visibility/presets | Already in repo; pairs well with headless table libs that let you keep shadcn styling. |
| shadcn/ui primitives (Radix + Tailwind) | (repo) | Consistent table/filter controls UI | Already used; shadcn’s Data Table guide is explicitly built around TanStack Table + a basic `<Table />` component. |
| TanStack Table (`@tanstack/react-table`) | v8 (major) | Table “engine”: sorting, filtering, grouping, column visibility, controlled state | Headless + feature-rich; matches shadcn’s recommended approach for “build your own” complex data tables. |
| Express + Mongoose | (repo) | Reporting APIs, presets storage, CSV streaming export | Already in repo; clean architecture layering (Routes→Controllers→Services→Models) fits adding report endpoints and a preset model/service cleanly. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
| ------- | ------- | ------- | ----------- |
| `@tanstack/react-virtual` | latest (pin during implementation) | Row virtualization (performance) | Use if raw report can render 1k–50k rows in UI; keeps scroll smooth without loading everything into DOM. |
| `csv-stringify` (or `csv` / `csv-stringify`) | latest (pin during implementation) | Server-side CSV generation via Node streams | Use for scalable CSV export of “all filtered rows” without loading the entire dataset into memory. |
| `papaparse` | optional | Client-side CSV generation/parsing | Only if you want *client-generated* CSV for small exports or need to parse uploaded CSV later; not required if export is server-streamed. |
| (existing) Joi | (repo) | Validate report queries + preset payloads at API boundary | Keeps validation consistent with current backend patterns (`src/middleware/validation.ts`). |

### Development Tools

| Tool | Purpose | Notes |
| ---- | ------- | ----- |
| Jest (existing) | Regression tests for report query building and preset storage | Add service-layer tests for aggregation pipelines and preset CRUD; keep controllers thin. |
| MongoDB indexes (schema-level) | Make filtering/sorting fast | Add compound indexes aligned to the most common report filters (e.g., `date`, `student_id`, `class_schedule_id`, `category`, `status`). |

## Installation

```bash
# Frontend (report UI)
cd frontend
pnpm add @tanstack/react-table
pnpm add @tanstack/react-virtual
# optional
pnpm add papaparse

# Backend (CSV streaming export)
cd ..
pnpm add csv-stringify
# or: pnpm add csv (full suite)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
| ----------- | ----------- | ----------------------- |
| TanStack Table | AG Grid | If you need an “all-in-one” grid with many enterprise UX features out of the box (and can accept heavier bundle + design constraints). |
| TanStack Table + shadcn `<Table />` | MUI DataGrid / Ant Design Table | If you already use those design systems; not a great fit here since the repo is shadcn/Tailwind-based. |
| Server-streamed CSV (`csv-stringify`) | Client-only CSV export | Only when datasets are guaranteed small; otherwise you’ll hit memory/time limits in the browser. |
| `csv-stringify` | `fast-csv` / `json2csv` | If you prefer a different CSV API; pick based on streaming support + ergonomics. |

## What NOT to Use

| Avoid | Why | Use Instead |
| ----- | --- | ----------- |
| Building a monolithic “ReportTable” that tries to cover every table use case | shadcn’s guidance is that each table tends to be unique; monoliths become rigid and hard to maintain | Follow the “guide” approach: shared primitives + per-report column definitions and state. |
| Fetching *all* rows for every interaction (filter/sort) | Doesn’t scale, increases backend load and UI latency | Use server-side filtering/sorting/pagination for raw mode when data grows; keep TanStack Table in controlled/manual mode. |
| Client-side CSV generation for large exports | Memory blowups and frozen tabs; can’t reliably export “all filtered rows” | Provide a backend `/export.csv` endpoint that streams. |

## Stack Patterns by Variant

### If the report dataset is small (e.g., a bounded date range)

- Use TanStack Table with client-side sorting/filtering on in-memory data.
- Because it’s simplest and the UX is instant.

### If the report dataset can be large (typical for attendance history)

- Use TanStack Table in controlled/manual mode and push sorting/filtering/pagination into backend query parameters.
- Because it prevents the UI from handling massive row counts and allows DB indexing to do the heavy lifting.

### If CSV export must handle large filtered exports

- Implement CSV export server-side using `csv-stringify` with Node stream.Transform and `res.write()` / `res.pipe()`.
- Because it’s scalable and avoids holding the whole export in memory.

### If presets must be shareable and consistent across devices

- Store presets server-side (Mongo) as a first-class resource: `{ ownerUserId?, isShared, name, reportType, tableState }`.
- Validate payloads with Joi; include a `schemaVersion` field to allow future migrations.

## Version Compatibility

| Package A | Compatible With | Notes |
| --------- | --------------- | ----- |
| Next.js@16.1.1 (repo) | React@19.2.3 (repo) | Verified in `frontend/package.json`. |
| `@tanstack/react-table` (v8 major) | React (verify exact peer range at install time) | TanStack Table is framework-agnostic and has a React adapter; verify peer deps when pinning versions since this repo uses React 19. |
| `csv-stringify` | Node.js runtime | Uses Node streaming APIs; good fit for Express responses and large datasets. |

## Sources

- <https://ui.shadcn.com/docs/components/data-table> — shadcn Data Table guide uses TanStack Table and covers sorting/filtering/visibility/pagination.
- <https://tanstack.com/table/latest> — TanStack Table overview and feature list (filter/sort/group/aggregate/visibility/virtualization).
- <https://csv.js.org/stringify/> — `csv-stringify` streaming-based CSV generation for Node.js.
- <https://www.papaparse.com/> — Papa Parse supports JSON→CSV and streaming (optional client-side path).

---
Stack research for: configurable reporting table + presets + CSV export
