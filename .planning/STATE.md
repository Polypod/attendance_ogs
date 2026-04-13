# STATE: Attendance OGS

**Updated:** 2026-04-13

## Project Reference

- **Core Value**: Admin och instruktörer kan snabbt få fram korrekt närvarodata (rådata eller summeringar), återanvända sparade vyer och exportera resultatet.
- **Current Focus**: Ny rapportsida i dashboarden (rådata + aggregerat) med presets och CSV-export.
- **Constraints**: Behåll befintlig stack (Next.js/React + shadcn/ui/Tailwind, Express/Mongoose). Rapporter är endast för ADMIN + INSTRUCTOR. CSV-export ska skala för stora datamängder (server-side streaming).

## Current Position

- **Phase**: Phase 3: Column, Sort & Selection Controls
- **Status**: Not started
- **Progress**: 2/5 phases complete

## Performance Metrics (targets)

- **Correctness**: Filter/datumintervall och totals ska vara konsekventa mellan vyer.
- **Stability**: Server-side paginering och export får inte krascha vid stora dataset.
- **Security**: Endast ADMIN/INSTRUCTOR har åtkomst till rapport-UI och report-API.

## Accumulated Context

- **Open decisions**:
  - Canonical tidszonsregel för datumintervall (ska dokumenteras och användas konsekvent i API + UI).
  - Definition av “antal närvarande” (vilka statusar räknas in) för aggregerat läge. (Nuvarande implementation räknar `present` + `late`.)
  - Behörighetsmodell för delade presets (rekommenderat: endast admin kan ändra/radera delade).
- **Blockers**: None known

## Session Continuity

- **Next command**: `/gsd-plan-phase 3`
- **Goal of next session**: Implementera kolumn visa/dölj, klick-sortering och global fri-text-sök (multi-val för sessions/classes/students/instructors är på plats).
