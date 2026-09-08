# Feature Research

**Domain:** Reporting UI for attendance system (karate club)
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
| ------- | ------------ | ---------- | ----- |
| Two modes: **Raw Data** + **Aggregated** | Users need both detailed inspection and high-level overview | MEDIUM | Raw data = one row per registration. Aggregated = predefined groupings/metrics. |
| Date range filter (“from–to”) | Reports are almost always about periods | MEDIUM | Time zone + “day boundary” must be consistent (server vs client interpretation). |
| Field filters per column | Standard in all modern reporting tables | MEDIUM | Support enum filters (status), relationship filters (class/student/instructor), multi-select where relevant. |
| Sorting per column (including secondary sort) | Expected for finding top/bottom items | LOW | Server-side sort for large datasets; lock sorting on computed columns if they cannot be sorted correctly. |
| Global free-text search | Quick way to find a student/class without building filters | MEDIUM | Define which fields are included (e.g. student name, class name). Avoid “search everything” if it becomes expensive. |
| Column management: show/hide + order | Everyone wants to focus on “their” view | MEDIUM | Save per view/preset. Avoid exporting hidden columns. |
| Pagination / “load more” | Datasets become large quickly | MEDIUM | Server-side pagination. Show total hits if cheap; otherwise “approximate” or “>N”. |
| Quick standard groupings (agg) | Users do not want to build their own pivots | MEDIUM | At minimum: by student, by instructor, by class/session, by class. |
| Core metrics in agg mode | Summaries without metrics feel pointless | LOW | V1 according to PROJECT.md: present count + total registration count. |
| CSV export of filtered result (“visible values”) | Common workflow: continue in Excel/Sheets | HIGH | Often requires server-side export/streaming for large volumes. The export must match the active column set. |
| Saved views/presets (private) | Reuse across days/devices | MEDIUM | Preset includes: mode, columns, sort, filter, grouping, metrics. |
| Shared presets (team standard) | Consistency within the club and easier onboarding | MEDIUM | Permission: who can create/edit shared? Version them or “copy to own” to avoid breaking others. |
| Role-based access (admin + instructor) | Reports contain personal data | LOW | Reuse existing RBAC. Log export events if needed. |
| Stable, “teacher-friendly” UX (tablet) | Primary user scenario according to PROJECT.md | MEDIUM | Large tap targets, clear empty states, avoid tiny filter popovers that are hard on touch. |
| Clear error/empty states + loading states | The user must understand “why am I seeing nothing?” | LOW | E.g. “No results for selected date range”, “You do not have permission”, “Export in progress”. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
| ------- | ----------------- | ---------- | ----- |
| Drill-down from agg → raw data (“click a group and see the rows”) | Makes agg mode auditable and increases trust | MEDIUM | Implement by having the agg row generate a filter that opens raw data with the same period/selection. |
| Period comparison (e.g. “this month vs last”) | Quick trend analysis without export | MEDIUM | Requires clear definitions (calendar month/week) and normalization. |
| Metrics like “attendance rate”, “streak”, “unique participants” | More value than pure counts | MEDIUM/HIGH | Needs defined denominators (scheduled sessions? registered students? selectable). |
| “Data quality” indicators in reports | Catches source-data problems early | MEDIUM | E.g. students without category/belt, sessions without instructor, duplicate registrations. |
| Quick filter chips (e.g. “last 7 days”, “absence only”) | Less friction for common questions | LOW | Complements field filters; should be predictable and easy to reset. |
| Preset sharing via link + copy/clone | Easy way to spread standard views | MEDIUM | Avoid the link becoming a “secret key” that bypasses RBAC; login should still be required. |
| Export as background job with notification | Export works even for large volumes | HIGH | UI: “Export started” → later download. Backend: queue, status, TTL. |
| “Explain this number” (explanation of aggregate definition) | Reduces interpretation disputes in the club | LOW/MEDIUM | E.g. tooltip: which statuses count as present, which time zone, which filters are active. |
| Favorites/“pin” for the 3 most common presets | Quick access on mobile | LOW | Small UX gains, high usefulness for instructors. |
| Localized dates/terms (sv/en) | Fewer misunderstandings, better adoption | LOW | Reports are especially sensitive to date formats and terminology. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
| ------- | ------------- | --------------- | ----------- |
| “Build your own pivot/BI” (free-form pivot builder) | Feels flexible and “professional” | Scope explodes, requires a semantic layer, hard to support | Predefined groupings + possibly a small number of selectable group-by options in v2. |
| Charts/BI dashboard in v1 | “It looks nice” | Distracts from correct data, requires more decisions (axes, normalization) | Add as v2+ once table/agg is stable. |
| Client-side filtering of the entire dataset | Quick to build initially | Scales poorly, heavy on tablets, risks loading PII unnecessarily | Server-side filtering/pagination + DB indexes. |
| Arbitrary ad hoc SQL/JSON queries in the UI | Power users want full control | High security risk, hard to secure/limit, creates support burden | Bounded query model via filter/sort + admin-only “debug export” in the backend if needed. |
| Excel/PDF export as a “must” in v1 | Feels more official than CSV | Much more maintenance (format, layout, encoding) | CSV in v1; evaluate Excel (XLSX) only when there is real demand. |
| Real-time updates (live refresh) | “Always up to date” | Complexity without clear value in historical reports | Manual refresh + clear “last updated” if relevant. |
| Shared presets without guardrails (everyone can edit everything) | “Simplest” | Leads to standard views suddenly changing for everyone | Ownership + permissions (e.g. admin owns shared) and/or “publish new version”. |

## Feature Dependencies

```text
Server-side filtering/sort/pagination
    └──requires──> Reporting API with stable query model
                       └──requires──> Indexing/optimization in DB for common filters

Aggregated mode
    └──requires──> Server-side aggregation pipelines (or pre-aggregation)

CSV export (entire filtered result set)
    └──requires──> Server-side export/streaming
                       └──enhances──> Export as background job (for large volumes)

Shared presets
    └──requires──> RBAC + preset ownership/permissions

Drill-down agg → raw data
    └──requires──> Agg rows can be translated into raw-data filters (unambiguous dimensions)

Global search
    └──conflicts──> Unbounded "search all fields" (expensive/unclear)
```

### Dependency Notes

- **Server-side filtering/sort/pagination requires a Reporting API:** The UI quickly becomes slow and inconsistent if logic is duplicated on the client.
- **Aggregated mode requires server-side aggregation:** Aggregating on the client means first fetching all rows, which does not scale.
- **CSV export often requires server-side streaming:** To avoid timeouts and memory issues when exports can become large.
- **Shared presets require RBAC + ownership:** Otherwise you get “who changed my view?” problems and accidental changes.
- **Global search conflicts with unclear search scope:** Define the fields (name/class) and make it predictable.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Raw data table with server-side pagination, field filters, sort, global search — core value for finding and exporting data
- [ ] Aggregated mode with standard groupings + core metrics — core value for quick overview
- [ ] Column management (show/hide) that affects both view and export — matches “visible values”
- [ ] Presets: private + shared (with a simple permission model) — reuse and standardization
- [ ] CSV export of the entire filtered result set (visible columns) — practical workflow

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Drill-down agg → raw data — when users want to verify summaries without exporting
- [ ] Export as background job with notification — when exports start timing out or becoming large
- [ ] Period comparison — when reports are used for follow-up over time
- [ ] Data quality indicators — when you want to increase trust in the data and catch bad registrations

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Selectable group-by/“semi-pivot” (limited) — only once standard groupings are no longer enough
- [ ] Excel (XLSX) export — only when CSV is no longer enough for the target audience
- [ ] Charts/BI visualization — after definitions/metrics are stable

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
| ------- | ---------- | ------------------- | -------- |
| Raw data table: filter/sort/pagination | HIGH | MEDIUM | P1 |
| Aggregated mode: standard groupings + metrics | HIGH | MEDIUM | P1 |
| Column show/hide (incl. export) | HIGH | MEDIUM | P1 |
| Private + shared presets | HIGH | MEDIUM | P1 |
| CSV export (entire filtered result set) | HIGH | HIGH | P1 |
| Global free-text search | MEDIUM | MEDIUM | P2 |
| Drill-down agg → raw data | MEDIUM/HIGH | MEDIUM | P2 |
| Export as background job | MEDIUM | HIGH | P2 |
| Period comparison | MEDIUM | MEDIUM | P3 |
| Data quality indicators | MEDIUM | MEDIUM | P3 |

**Priority key:**

- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A (Spreadsheets: Excel/Sheets) | Competitor B (“typical membership/club admin system”) | Our Approach |
| ------- | ----------------------------------------- | --------------------------------------------------- | ----------- |
| Raw data + custom filter/sort | Very strong once the data has been exported | Often limited or “fixed” | Build a strong table in the app so export is not the only path. |
| Aggregations/metrics | Requires manual work (pivot/formulas) | Often simple summaries | Predefined summaries that match the karate school’s needs. |
| Saved views/presets | Possible via shared sheets/tabs | Varies | Presets in DB: private + shared standard views. |
| CSV export | Standard | Common | Export “visible values” and the entire filtered dataset. |
| Drill-down and traceability | Requires manual work | Often missing | Drill-down from agg to raw data with the same filters. |

## Sources

- `.planning/PROJECT.md` (requirements and scope for the reports page)
- Practical UX patterns from datagrids/report tables (general industry pattern; not project-specific external sources)

---
*Feature research for: Reporting UI for attendance system*
*Researched: 2026-04-13*
