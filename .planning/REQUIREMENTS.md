# Requirements: Attendance OGS

**Defined:** 2026-04-13
**Core Value:** Admins and instructors can quickly access accurate attendance data (raw data or summaries), reuse saved views, and export the results.

## v1 Requirements

### Security & Access

- [x] **SEC-01**: Only the **ADMIN** and **INSTRUCTOR** roles can access the reporting page and the report API
- [x] **SEC-02**: Instructors can see all data in v1 (no “only their own sessions” restriction)

### Reporting Views (Raw Data + Aggregated)

- [x] **RPT-01**: The user can switch between **Raw Data** and **Aggregated** mode
- [x] **RPT-02**: Raw Data mode displays a table with one row per attendance record
- [x] **RPT-03**: Aggregated mode offers a **selectable aggregation level** (standard groupings): **student**, **instructor**, **session (class/session)**, **class**
- [x] **RPT-04**: Aggregated mode displays at least the key metrics **number present** and **total number of records**
- [ ] **RPT-05**: The user can show/hide columns in the list; hidden columns must not be exported
- [x] **RPT-06**: The **Sessions (Class schedule)** filter supports multi-select of **individual sessions** (classScheduleId + date), not just “all similar ones” via a schedule-id

### Query (Filter, Sort, Search)

- [x] **QRY-01**: The user can filter by **date range (from–to)** with a consistent and documented timezone rule
- [x] **QRY-02**: The user can filter per field (at minimum: student, instructor, class/session, status)
- [ ] **QRY-03**: The user can sort by selected columns by clicking the column header (server-side where relevant)
- [ ] **QRY-04**: The user has global free-text search that searches within a defined field set (at minimum name/class)
- [x] **QRY-05**: Results are listed with server-side pagination so that large data sets are handled reliably
- [x] **QRY-06**: It must be possible to select multiple students, preferably via checkbox
- [x] **QRY-07**: It must be possible to select multiple instructors, preferably via checkbox

### Presets (Private + Shared)

- [ ] **PRS-01**: The user can save a preset that includes: view mode, selected columns, sorting, filters, grouping, and key metrics
- [ ] **PRS-02**: Presets are stored server-side per user and can be reused across devices
- [ ] **PRS-03**: The user can list, update, and delete their own presets
- [ ] **PRS-04**: Presets can be marked as **shared** (global); other users can see and use shared presets
- [ ] **PRS-05**: There is a clear permission model for shared presets (who may create/update/delete)
- [ ] **PRS-06**: Presets are versioned (e.g. `schemaVersion`) and validated when loaded

### Export (CSV)

- [ ] **EXP-01**: The user can export CSV for the full filtered result with the columns active in the view
- [ ] **EXP-02**: CSV export uses the same query definition as the table (no mismatch between view and export)
- [ ] **EXP-03**: CSV export is robust for larger data sets (server-side streaming/backpressure)
- [ ] **EXP-04**: CSV export protects against formula/CSV injection in common spreadsheet programs

## v2 Requirements (Deferred)

### Reporting Enhancements

- **RPTX-01**: Drill-down from aggregated row to the corresponding raw-data filter
- **RPTX-02**: More key metrics (e.g. attendance percentage) with clear definitions
- **RPTX-03**: Quick filter chips (e.g. ”last 7 days”, ”absence only”)

### Export Enhancements

- **EXPX-01**: Export as a background job (queue + notification) for very large exports
- **EXPX-02**: Excel/XLSX export

### Access Enhancements

- **SECX-01**: Optional restriction for instructors to ”their own sessions/classes”

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Pivot/BI builder (free group-by/pivot) | Scope explosion and high complexity |
| Charts/BI dashboard in v1 | Requires more semantic decisions; focus on correct table/aggregation first |
| PDF export in v1 | High maintenance; CSV is sufficient initially |

## Traceability

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| RPT-01 | Phase 2 | Complete |
| RPT-02 | Phase 1 | Complete |
| RPT-03 | Phase 2 | Complete |
| RPT-04 | Phase 2 | Complete |
| RPT-05 | Phase 3 | Pending |
| RPT-06 | Phase 2 | Complete |
| QRY-01 | Phase 1 | Complete |
| QRY-02 | Phase 1 | Complete |
| QRY-03 | Phase 3 | Pending |
| QRY-04 | Phase 3 | Pending |
| QRY-05 | Phase 1 | Complete |
| QRY-06 | Phase 3 | Pending |
| QRY-07 | Phase 3 | Pending |
| PRS-01 | Phase 4 | Pending |
| PRS-02 | Phase 4 | Pending |
| PRS-03 | Phase 4 | Pending |
| PRS-04 | Phase 4 | Pending |
| PRS-05 | Phase 4 | Pending |
| PRS-06 | Phase 4 | Pending |
| EXP-01 | Phase 5 | Pending |
| EXP-02 | Phase 5 | Pending |
| EXP-03 | Phase 5 | Pending |
| EXP-04 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after roadmap mapping*
