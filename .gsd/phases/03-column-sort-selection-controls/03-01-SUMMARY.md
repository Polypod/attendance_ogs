---
phase: 03-column-sort-selection-controls
plan: 01
subsystem:
  - api
  - reporting
tags: [mongoose, aggregation, search, sorting, collation, joi, jest]

requires:
  - phase: 02-aggregated-reporting
    provides: attendance aggregated reporting endpoints
provides:
  - Global fri-text-sök (search) i raw + aggregated report pipelines
  - Sort-semantik: aggregated default = presentCount desc (student/instructor/class)
  - Sort-semantik: case-insensitive strängsort + tomma värden sist (för strängfält)
affects: [frontend-reports, phase-03]

tech-stack:
  added: []
  patterns:
    - "Aggregation: post-lookup $match byggs via $and för att kombinera filter + search"
    - "Sorting: __sortEmpty används för empty-last på strängsort"

key-files:
  created: []
  modified:
    - src/services/ReportService.ts
    - src/__tests__/services/ReportService.test.ts

key-decisions:
  - "Aggregated default-sort ändrad till presentCount desc enligt Phase 3 CONTEXT"
  - "Case-insensitive sort implementerad via aggregate collation (sv, strength=2)"

patterns-established:
  - "För sträng-sort: lägg till __sortEmpty och sortera på den först"

duration: 45min
completed: 2026-04-14
---

# Phase 3 (03-01) Summary

**Backend-stöd för global fri-text-sök samt uppdaterade sorteringsregler för rapportsystemet (raw + aggregated).**

## Accomplishments

- Lagt till `search` i både raw och aggregated report-pipelines (söker på student/klass/instruktör).
- Justerat sortering så aggregerat default är “mest närvaro först” (presentCount desc) för student/instructor/class.
- Implementerat case-insensitive sort (collation) och “tomma sist” för sträng-sort (via `__sortEmpty`).
- Utökat ReportService-tester för search + sort-semantik.

## Task Commits

1. **Task 2: Implementera global sök i ReportService** — `b7eb072` (feat)
2. **Task 3: Justera sorteringsregler + tester** — `dc7f8e8` (test)

Note: Task 1 (Joi schema) var redan uppdaterad i codebase (ingen ny commit i denna plan-körning).

## Files Modified

- src/services/ReportService.ts — search + sort-semantik i pipelines
- src/__tests__/services/ReportService.test.ts — verifierar search, default-sort och empty-last/case-insensitive

## Verification

- `pnpm test` (pass)

## Deviations from Plan

- Små avvikelser i commit-granularitet: feature-commit innehåller både search + sort-semantik (för att undvika interaktiv staging i denna miljö).
