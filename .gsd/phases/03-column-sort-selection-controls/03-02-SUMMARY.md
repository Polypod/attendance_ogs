---
phase: 03-column-sort-selection-controls
plan: 02
subsystem:
  - ui
tags: [nextjs, reports, search, sorting, columns]

requires:
  - phase: 03-column-sort-selection-controls/03-01
    provides: Reports-sida med raw/aggregated vy, tabell och filterpanel
provides:
  - Global fri-text-sök i Reports (raw + aggregated)
  - Sort via rubriker utan auto-reset till sida 1
  - Separat kolumn-visa/dölj state per läge (raw vs aggregated) utan persistens
affects: [reports, phase-04-presets]

tech-stack:
  added: []
  patterns:
    - "POST body inkluderar search när non-empty"
    - "Pagination reset: endast på filter/search (inte på sort)"
    - "Kolumn-visibility hålls separat per vy-läge"

key-files:
  created: []
  modified:
    - frontend/src/app/dashboard/reports/page.tsx

key-decisions:
  - "Implementerade D3-06: sortbyte ska inte hoppa tillbaka till sida 1"
  - "Implementerade D3-07/D3-09: raw-defaultkolumner samt separata kolumnval per läge"
  - "Följde D3-10: ingen persistens av kolumnval (reset vid reload)"

patterns-established:
  - "Reports-filterpanelen inkluderar global sök som skickas i samma query-body som övriga filter"

# Metrics
duration: 3m
completed: 2026-04-15
---

# Phase 3 Plan 02: Reports search + column visibility per mode Summary

**Reports-sidan har nu global fri-text-sök, separata kolumnval per läge, och sortering som inte reset:ar paginering.**

## Performance

- **Duration:** 3m
- **Started:** 2026-04-15T05:20:00Z
- **Completed:** 2026-04-15T05:22:55Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Lade till global fri-text-sök och skickar `search` i request body (raw + aggregated)
- Justerade page-reset så att sort inte hoppar till sida 1
- Delade upp kolumn-visibility state för raw och aggregated utan persistens

## Task Commits

1. **Task 1: Lägg till global fri-text-sök i Reports UI och skicka `search` till API** - `088d210`
2. **Task 2: Kolumn-visa/dölj separat för Raw och Aggregated (utan persistens)** - `6c06b23`

## Files Created/Modified

- frontend/src/app/dashboard/reports/page.tsx - Global sök, sort-UX regel (ingen page reset), och separata kolumnval per läge

## Decisions Made

- None - följde planen och Phase 3 CONTEXT (D3-06/07/09/10) som specificerat.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm --prefix frontend build` gav en Next.js-varning om flera lockfiles, men bygget var grönt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Reports-UX är stabil för nästa steg (Phase 4 Presets) där kolumnval kan persisteras.

## Self-Check: PASSED

- Summary skapad: `.gsd/phases/03-column-sort-selection-controls/03-02-SUMMARY.md`
- Frontend build: `pnpm --prefix frontend build` (PASS)
- Task commits:
  - `088d210`
  - `6c06b23`

---

_Phase: 03-column-sort-selection-controls_
_Completed: 2026-04-15_
