# ROADMAP: Attendance OGS

**Created:** 2026-04-13
**Granularity:** standard

## Phases

- [x] **Phase 1: Secure Raw Reporting** - Reporting page + report API for raw data with RBAC, date range, field filters, and server-side pagination.
- [x] **Phase 2: Aggregated Reporting** - Aggregated mode with standard groupings and key metrics, as well as switching between raw/agg.
- [ ] **Phase 3: Column, Sort & Selection Controls** - Column show/hide, sorting (click on header), global free-text search, and improved multi-select.
- [ ] **Phase 4: Presets (Private + Shared)** - Save/reuse presets server-side with sharing, policy, and versioning.
- [ ] **Phase 5: CSV Export (Streaming + Safe)** - CSV export that matches the view, streams large data sets, and protects against CSV injection.

## Phase Details

### Phase 1: Secure Raw Reporting

**Goal**: Admins and instructors can open the reporting page and view raw data (one row per attendance record) with reliable filtering and pagination.
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, RPT-02, QRY-01, QRY-02, QRY-05
**Success Criteria** (what must be TRUE):

  1. ADMIN and INSTRUCTOR can access the reporting page; other roles are denied access.
  2. Raw Data mode displays a table with one row per attendance record.
  3. The user can filter by date range (from–to) according to a consistent and documented timezone rule.
  4. The user can filter at minimum by student, instructor, class/session, and status, and the result updates correctly.
  5. Results are listed with server-side pagination (including total/count) so that large data sets are handled reliably.

**Plans**: 01-01, 01-02
**UI hint**: yes

### Phase 2: Aggregated Reporting

**Goal**: The user can switch to aggregated mode and view standard summaries with key metrics.
**Depends on**: Phase 1
**Requirements**: RPT-01, RPT-03, RPT-04, RPT-06
**Success Criteria** (what must be TRUE):

  1. The user can switch between Raw Data and Aggregated mode.
  2. Aggregated mode offers standard groupings: student, instructor, session/class, and class.
  3. Aggregated mode displays at least the key metrics number present and total number of records.
  4. Aggregated results respect the same filters/date range as the report query.
  5. The Sessions (Class schedule) filter supports multi-select of individual sessions (schedule + date).

**Plans**: TBD
**UI hint**: yes

### Phase 3: Column, Sort & Selection Controls

**Goal**: The user can customize the table (columns/sort/search) and selections (multi-select) without losing backend consistency.
**Depends on**: Phase 2
**Requirements**: RPT-05, QRY-03, QRY-04, QRY-06, QRY-07
**Success Criteria** (what must be TRUE):

  1. The user can show/hide columns in the table.
  2. The user can sort by selected columns (server-side where relevant), and the sorting is correctly reflected in the result.
  3. The user has global free-text search that searches within a defined field set (at minimum name/class) and can be combined with other filters.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Presets (Private + Shared)

**Goal**: The user can save and reuse report views/presets (private and shared) in a secure and robust way.
**Depends on**: Phase 3
**Requirements**: PRS-01, PRS-02, PRS-03, PRS-04, PRS-05, PRS-06
**Success Criteria** (what must be TRUE):

  1. The user can save a preset that includes: view mode, selected columns, sorting, filters, grouping, and key metrics.
  2. Presets are stored server-side per user, can be reused across devices, and the user can list/update/delete their own presets.
  3. Presets can be marked as shared (global), and other users can see and use shared presets.
  4. The permission model for shared presets is clear and prevents unauthorized creation/update/deletion.
  5. Presets are versioned (e.g. schemaVersion) and validated when loaded.

**Plans**: TBD
**UI hint**: yes

### Phase 5: CSV Export (Streaming + Safe)

**Goal**: The user can export CSV that exactly matches the report view and also works for large data sets.
**Depends on**: Phase 4
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**Success Criteria** (what must be TRUE):

  1. The user can export CSV for the full filtered result with the columns active in the view.
  2. CSV export uses the same query definition as the table (no mismatch between view and export).
  3. CSV export is robust for larger data sets (server-side streaming/backpressure).
  4. CSV export protects against formula/CSV injection in common spreadsheet programs.

**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
| ----- | -------------- | ------ | --------- |
| 1. Secure Raw Reporting | 2/2 | Complete | 2026-04-13 |
| 2. Aggregated Reporting | 0/TBD | Complete | 2026-04-13 |
| 3. Column, Sort & Selection Controls | 0/TBD | Not started | - |
| 4. Presets (Private + Shared) | 0/TBD | Not started | - |
| 5. CSV Export (Streaming + Safe) | 0/TBD | Not started | - |
