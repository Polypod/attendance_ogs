# Attendance OGS

## What This Is

Attendance OGS is an attendance system for a karate club/school: manage students, classes, and sessions, and record and edit attendance. The next focus is a new reporting page in the dashboard that makes it easy to generate summaries and export data.

## Core Value

Admins and instructors can quickly access accurate attendance data (raw data or summaries), reuse saved views, and export the results.

## Requirements

### Validated

- ✓ Authentication + role-based access (RBAC) — existing
- ✓ Student management with categories and belt levels — existing
- ✓ Class/session management and calendar — existing
- ✓ Attendance registration per session and student, including historical edits — existing
- ✓ Dashboard for today's sessions — existing

- ✓ **Reporting page (raw data)** for admin + instructor — table (one row per attendance record) with filters and pagination (Phase 1)
- ✓ **Reporting page (aggregated mode)** — standard groupings (student/instructor/session/class) and key metrics (Phase 2)

### Active

- [ ] **Column management**: ability to show/hide optional fields in the table
- [ ] **Sorting + filtering per field** (including date ranges where relevant) as well as **global free-text search**
- [ ] **Presets**: save and reuse table settings server-side per user, with support for **shared presets**
  - A preset should include: view mode (raw/agg), selected columns, sorting, filters, grouping, and key metrics
- [ ] **CSV export** of “visible values”: export the full filtered result with the columns active in the view

### Out of Scope

- Charts/BI dashboard (e.g. graphs, pivot builder) — not a core requirement for the first release
- PDF/Excel export — CSV is sufficient initially
- Advanced permission model per instructor (”only their own sessions”) — initially, instructors can see all data

## Context

- Monorepo: Express + Mongoose backend (`src/`) and Next.js App Router frontend (`frontend/src/`).
- Domain config (categories, belt levels) is YAML-driven via `config/system.yaml` and `ConfigService`.
- Attendance data is linked to student + session (class schedule) + date + status, and must be able to be summarized across multiple dimensions.
- The reporting page should be teacher-friendly and work well on tablets.

## Constraints

- **Tech stack**: Keep the existing stack (Next.js/React + shadcn/ui/Tailwind in the frontend; Express/Mongoose in the backend) — minimize new dependencies.
- **Security/Access**: Reports are only for admin + instructor — why: they contain personal data and internal operational data.
- **Scalability**: CSV export of the full filtered result must work even with larger data sets — this may require server-side export/streaming.
- **Presets**: Presets must be savable per user and be able to be marked as shared/globally reusable.

## Key Decisions

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| Two reporting modes (raw data + aggregated) | Need both detailed inspection and quick summaries | Implemented (Phase 1–2) |
| Admin + instructor get access | Primary users for follow-up | — Pending |
| Instructors can see all data initially | Simpler rules, faster delivery | — Pending |
| Presets are saved in the DB per user + shared presets | Reuse across devices + team standardization | — Pending |
| CSV exports the full filtered result with active columns | Matches “visible values” and real export value | — Pending |
| Global free-text search in addition to field filters | Quick navigation for names/class | — Pending |
| Standard groupings: student, instructor, session, class | Covers the most common reporting dimensions | — Pending |
| Key metrics in v1: number present + total number of records | Minimal but useful summaries | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

### After each phase transition (via `/gsd-transition`)

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

### After each milestone (via `/gsd-complete-milestone`)

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
Last updated: 2026-04-13 after Phase 2 completion
