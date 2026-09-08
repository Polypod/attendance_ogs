# STATE: Attendance OGS

**Updated:** 2026-04-13

## Project Reference

- **Core Value**: Admins and instructors can quickly access accurate attendance data (raw data or summaries), reuse saved views, and export the results.
- **Current Focus**: New reporting page in the dashboard (raw data + aggregated) with presets and CSV export.
- **Constraints**: Keep the existing stack (Next.js/React + shadcn/ui/Tailwind, Express/Mongoose). Reports are only for ADMIN + INSTRUCTOR. CSV export must scale for large data sets (server-side streaming).

## Current Position

- **Phase**: Phase 3: Column, Sort & Selection Controls
- **Status**: Not started
- **Progress**: 2/5 phases complete

## Performance Metrics (targets)

- **Correctness**: Filters/date ranges and totals must be consistent between views.
- **Stability**: Server-side pagination and export must not crash on large data sets.
- **Security**: Only ADMIN/INSTRUCTOR have access to the report UI and report API.

## Accumulated Context

- **Open decisions**:
  - Canonical timezone rule for date ranges (must be documented and used consistently in API + UI).
  - Definition of “number present” (which statuses count) for aggregated mode. (Current implementation counts `present` + `late`.)
  - Permission model for shared presets (recommended: only admins can update/delete shared ones).
- **Blockers**: None known

## Session Continuity

- **Next command**: `/gsd-plan-phase 3`
- **Goal of next session**: Implement column show/hide, click-to-sort, and global free-text search (multi-select for sessions/classes/students/instructors is in place).
