# Pitfalls Research

**Domain:** Reporting UI (raw data + aggregated) + presets + CSV export for attendance system
**Researched:** 2026-04-13
**Confidence:** MEDIUM

> **Phase legend (for roadmap mapping):**
>
> - **Phase R1 — Report contract & semantics:** define fields, time zone, “present” definitions, which dimensions are allowed.
> - **Phase R2 — Backend query + security:** API contract, whitelists, validation, RBAC, index plan, aggregations.
> - **Phase R3 — Presets (persistence + sharing):** data model, ownership, versioning/migration, sharing rules.
> - **Phase R4 — UI (state + table):** filter/sort/column handling, mobile/touch UX, sync between URL↔state↔preset.
> - **Phase R5 — Export (CSV):** “visible values”, streaming, interruption/backpressure, injection protection, audit.
> - **Phase R6 — Verification & hardening:** performance/testing, correctness, observability, regression protection.

## Critical Pitfalls

### Pitfall 1: Unclear report semantics (“What does the number mean?”)

**What goes wrong:**
Users get different answers depending on view mode, filter combination, or interpretation (e.g. “present” sometimes counts only certain statuses). Aggregated totals feel “wrong” and lose trust.

**Why it happens:**
Reporting features are often built UI-first (“add filter + group-by”) without first defining the domain’s metrics, time zone, and normalization.

**How to avoid:**

- Define a small “report contract”: fields, data types, which statuses are included in metrics, and which standard groupings exist.
- Write down the time zone rule: *which zone is used for date ranges and day boundaries?* (server zone vs user zone).
- Add a clear “definition” area in the UI (tooltip/section) that shows: active filters + what the metrics mean.

**Warning signs:**

- Questions like “why does the export differ from the table?” or “why is the total different from what I count manually?”
- More and more special cases in code: “if groupBy==X and filter==Y then…”

**Phase to address:**
Phase R1 — Report contract & semantics

---

### Pitfall 2: Time zone and date-range bugs (off-by-one days)

**What goes wrong:**
Reports show the wrong day, miss late sessions, or include/exclude registrations right around midnight. The export does not match the UI.

**Why it happens:**
Date ranges are implemented across multiple layers (frontend, backend, DB) and mix local dates (“2026-04-13”) with timestamps without clear normalization.

**How to avoid:**

- Choose a canonical representation for filters: e.g. send ISO timestamps with explicit time zone/offset, or send date + explicit zone and let the backend expand to [start,end).
- Standardize intervals as *inclusive start, exclusive end* ($[from, to)$) to avoid double interpretation.
- Add edge-case tests for boundaries: midnight, daylight saving time shifts, and late-evening sessions.

**Warning signs:**

- Support tickets about the “wrong day” or “missing yesterday’s last session”.
- Seeing `new Date('YYYY-MM-DD')` in the frontend (often interpreted as UTC on many platforms) without clear zone handling.

**Phase to address:**
Phase R1 — Report contract & semantics

---

### Pitfall 3: UI and backend filters drift apart (mismatch between “visible” and “valid”)

**What goes wrong:**
The UI allows filters/sorts the backend does not support (or interprets differently). The result is “empty tables”, inconsistent exports, or 500 errors for certain combinations.

**Why it happens:**
Filters are built ad hoc in the UI and the backend treats query parameters as free-form strings. There is no strict, versionable query model.

**How to avoid:**

- Define a whitelist of filterable/sortable fields per report type (raw vs agg).
- Validate all filters in the backend (Joi) and return 400 with a clear error for invalid combinations.
- Version the query contract (at least implicitly via `reportType`) so presets can be migrated.

**Warning signs:**

- Passing `{ sortBy: req.query.sortBy }` directly into Mongo/Mongoose.
- “It works in the UI but the export is different” (export endpoint uses a different code path).

**Phase to address:**
Phase R2 — Backend query + security

---

### Pitfall 4: Presets become fragile without schema version and migration

**What goes wrong:**
After a small change (new column, renamed field, new groupBy), old presets stop working or produce subtly wrong data. Shared presets can “break” things for other users.

**Why it happens:**
Presets save “raw” table state without a version field and without a clear ownership/publishing model.

**How to avoid:**

- Save presets with `schemaVersion` + `reportType` and a clear model: `ownerUserId`, `isShared`, `name`, `state`.
- On load: validate and migrate state (best effort) or flag it as “needs updating”.
- For shared presets: use a “publish” flow (e.g. admin-only) or “clone to own” instead of everyone editing the same one.

**Warning signs:**

- Presets save only a blob without metadata.
- New columns break rendering (undefined access) when a preset loads.

**Phase to address:**
Phase R3 — Presets (persistence + sharing)

---

### Pitfall 5: “CSV export of visible values” gets implemented as “export current page”

**What goes wrong:**
The user believes the export contains the full filtered result, but only gets the first page/current page. Trust collapses.

**Why it happens:**
Tables are built with pagination; export is wired to the UI’s current data array instead of running the same filter server-side.

**How to avoid:**

- Make export a separate backend endpoint that takes the exact same filter/sort/column selection as the view.
- In the UI: clearly show “Exporting all X matching rows” (if X exists) or “Exporting all matching rows”.
- Make sure export uses the same query builder as the table (shared service).

**Warning signs:**

- The export button serializes only `currentRows`.
- Bug reports like “export is missing data I can see in the table” or the reverse.

**Phase to address:**
Phase R5 — Export (CSV)

---

### Pitfall 6: Large exports built without streaming/backpressure → memory death or timeouts

**What goes wrong:**
CSV export for larger date ranges crashes (OOM), hangs, or times out through the proxy. The API becomes unstable.

**Why it happens:**
CSV is generated by loading all rows into memory and then calling `res.send(csvString)`; or rows are written too quickly to `res.write()` without respecting backpressure.

**How to avoid:**

- Stream the export (cursor/iterator) and write row by row.
- Respect backpressure/`drain` or use `stream.pipeline()`/`node:stream/promises`.
- Set realistic limits: max date span for interactive export, or implement background jobs later if needed.
- Consider reverse proxy timeouts/buffering for long responses.

**Warning signs:**

- “JavaScript heap out of memory” during export.
- Export works locally but not in prod (504, proxy buffers).

**Phase to address:**
Phase R5 — Export (CSV)

---

### Pitfall 7: CSV injection (formula injection) via name/class fields

**What goes wrong:**
If a student/class/instructor name starts with `=`, `+`, `-`, `@`, Excel/Sheets may interpret the cell as a formula when the CSV is opened. In the worst case, this can lead to exfiltration or other attacks.

**Why it happens:**
CSV is seen as “just text” and the export contains user-generated fields without sanitization.

**How to avoid:**

- Sanitize CSV fields for spreadsheet consumption: prefix risky prefixes (`=`, `+`, `-`, `@`) according to established mitigation, and always quote fields.
- Document the trade-off: sanitization can affect machine import (but it is the right choice if the target is Excel).

**Warning signs:**

- Exports are routinely used in Excel.
- No tests that the export handles “dangerous” cell prefixes.

**Phase to address:**
Phase R5 — Export (CSV)

---

### Pitfall 8: Aggregations in MongoDB become expensive and hard to optimize

**What goes wrong:**
Agg mode becomes slow or unstable, especially when many filters and group-by are combined. The team starts moving logic into the app server and pulling home large datasets instead.

**Why it happens:**
A “generic” aggregation pipeline is built to support everything, without designing for indexes and without limiting combinations.

**How to avoid:**

- Keep a small number of predefined agg variants (one per standard grouping) and build the pipeline explicitly.
- Place `$match` early and use `$project` to reduce payload.
- Ensure indexes that match the most common `$match` + `$sort`.
- If the pipeline can become large: evaluate `allowDiskUse` and/or tighter export limits.

**Warning signs:**

- Agg endpoints have long tail latency (p95/p99) and CPU spikes.
- `$lookup`/`populate` are used at high volume without measurement.

**Phase to address:**
Phase R2 — Backend query + security

---

### Pitfall 9: Shared presets become an “IDOR” surface (unauthorized access via preset ID)

**What goes wrong:**
A user can read/edit presets they should not see (e.g. by guessing IDs). Or shared presets accidentally leak PII through columns that should not be exportable.

**Why it happens:**
Preset resources are treated as “harmless” and are not protected as strictly as report data.

**How to avoid:**

- Run RBAC/ownership checks on preset CRUD: owner can manage their own, shared requires explicit policy.
- Store state only; decide server-side which columns may be used in export at all.
- Log and consider audit for export events (at least server-side logging).

**Warning signs:**

- Preset endpoints lack auth middleware.
- `shared=true` means everyone can write.

**Phase to address:**
Phase R3 — Presets (persistence + sharing)

---

### Pitfall 10: “Global search” becomes either too expensive or too vague

**What goes wrong:**
Global free-text search takes too long (full collection scan), or returns unexpected results (searches too many/odd fields). The user does not trust search.

**Why it happens:**
Global search is implemented as “regex over everything” or as an afterthought without defined fields.

**How to avoid:**

- Define exactly which fields are included (e.g. student name, class name, instructor).
- For raw data: consider a pre-indexed searchable field (e.g. `searchText`) or a Mongo text index if it fits.
- Limit global search in agg mode (often meaningless).

**Warning signs:**

- Search = `$or` with many regexes.
- Search causes timeouts as the dataset grows.

**Phase to address:**
Phase R2 — Backend query + security

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
| -------- | ----------------- | -------------- | --------------- |
| Client-side filtering/sorting on the entire dataset | Fast to build | Scales poorly, PII is loaded unnecessarily, slow on tablets | Only if the dataset is strictly small (e.g. tightly bounded date range) and can be guaranteed |
| “Generic report endpoint” with free-form fields/ops | Maximum flexibility | Hard to secure/validate, hard to index, presets break often | Almost never in v1; better to use whitelists per report |
| Preset = raw TanStack state without schemaVersion | Quick to save | Breaks at the smallest column change, hard to migrate | Only as a prototype; not if presets should be “real” |
| Export built as `JSON→CSV` in memory | Simple | OOM/timeouts for larger exports | Only for small exports, otherwise streaming |
| Aggregation in the app server (fetch all, group in JS) | Easy to debug | Extremely expensive, wrong with pagination, slow | Only for very small datasets and as a temporary comparison in tests |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
| ----------- | -------------- | ---------------- |
| Spreadsheet programs (Excel/Sheets) | Assume CSV is a “passive” text format | Handle CSV injection, quote fields, test with real tools |
| Reverse proxy (Apache/Nginx) | Default timeouts/buffering kill long exports | Ensure timeouts/buffering for streaming endpoints, or limit export size |
| Auth (NextAuth/JWT) + file download | Export endpoint is called without the right token/headers | Reuse the `fetchWithAuth()` pattern and test the download flow in the browser |
| ConfigService (categories/belts) | Filter lists are hardcoded and become stale | Read dynamically from config and handle config changes (e.g. invalid presets) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
| ---- | -------- | ---------- | -------------- |
| Missing/poor MongoDB indexes for common filter/sort | P95 latency spikes, CPU spikes | Index plan based on the report contract; measure with explain/profiling | When history grows (months→years) |
| Sorting on computed/lookup fields | Sort becomes extremely expensive, spills to disk | Limit sortable fields; precompute if needed | Already at thousands of rows if the pipeline becomes heavy |
| UI renders too many rows without virtualization | Scrolling stutters, iPad gets hot | Pagination + row virtualization in raw data | 1k–10k+ DOM rows |
| Export without backpressure | RSS grows and the process dies | Stream/pipeline, respect `drain` | With large exports or a slow client |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
| ------- | ---- | ---------- |
| CSV injection (formula injection) | Exfiltration/attack when CSV is opened in Excel | Sanitize cells, quote fields, test with dangerous prefixes |
| Missing whitelist for sort/filter | NoSQL-injection-like risk + DoS (expensive query) | Allow only known fields/ops and validate payload |
| Shared presets without ownership/policy | Unauthorized read/write (IDOR) | Access controls and audit, limit what shared presets may change |
| Export endpoint bypasses RBAC | Mass leakage of personal data | Same auth middleware + service-layer enforcement |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
| ------- | ----------- | --------------- |
| Unclear “what is active” (filter/sort/columns) | The user thinks the data is wrong | Show active filter chips + “reset all” + clear sort indicator |
| Agg mode without drill-down | Distrust of totals, hard to verify | Let agg rows create the corresponding raw-data filter (drill-down) |
| Touch targets and popovers that are too small | Frustration on tablets | Larger controls, simplify filter UI, avoid dense table layout on iPad |
| Preset changes that suddenly affect others | Team loses trust | “Clone” shared presets to your own or version/publish them |

## "Looks Done But Isn't" Checklist

- [ ] **Date range:** Same time zone/normalization in UI, API, and export.
- [ ] **Export:** Exports *all* filtered rows (not just current page) and exactly the active columns.
- [ ] **Presets:** Have `schemaVersion` and are validated/migrated on load.
- [ ] **Shared presets:** Have a clear ownership policy (who may create/edit) and correct auth checks.
- [ ] **Agg mode:** Metric definitions are explicit and verifiable (preferably via drill-down).
- [ ] **Global search:** Fields are defined + performance has been tested, not “regex over everything”.
- [ ] **Indexes:** Exist for the most common filters/sorts and have been verified with measurement.
- [ ] **CSV security:** CSV injection mitigation is in place and tested.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
| ------- | ------------- | -------------- |
| Unclear semantics → wrong numbers | HIGH | Freeze the report definition, write a “contract”, backfill tests, communicate the change, migrate presets |
| Time zone bugs | MEDIUM/HIGH | Add canonical filter representation, migrate UI, backfill regression tests (DST/midnight) |
| Presets broken after release | MEDIUM | Add schemaVersion+migrator, auto-fix or mark presets as “requires update” |
| Export OOM/timeouts | MEDIUM/HIGH | Switch to streaming, add limits, possibly background jobs later |
| CSV injection discovered | MEDIUM | Patch sanitization, rotate/warn users, add test cases and security checklist |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
| ------- | ---------------- | ------------ |
| Unclear report semantics | Phase R1 | Metrics have documented definitions; drill-down yields the same totals |
| Time zone/off-by-one | Phase R1 | Test cases for midnight/DST; UI and export match |
| UI/backend mismatch | Phase R2 | Backend validates and returns 400 for invalid filters; export/table share query builder |
| Presets without version/migration | Phase R3 | Presets have schemaVersion and are migrated/validated on load |
| Export = current page | Phase R5 | Export contains the full filtered dataset; compare against API count |
| Export without streaming/backpressure | Phase R5 | Export handles large volumes without memory growth; proxy timeouts are handled |
| CSV injection | Phase R5 | Test with values starting with `=,+,-,@` are safe in Excel |
| Expensive aggregations | Phase R2 | Agg endpoints have acceptable p95; indexes and early `$match` verified |
| Shared presets IDOR/policy | Phase R3 | Access test: cannot read/edit others’ private presets; shared follows policy |
| Global search too expensive/vague | Phase R2 | Search fields are limited and measured; no full scans in normal cases |

## Sources

- <https://owasp.org/www-community/attacks/CSV_Injection> — CSV/Formula Injection and mitigations (including Excel behavior).
- <https://nodejs.org/api/stream.html> — Node streams, backpressure, and `pipeline()` (relevant for streaming export).
- <https://www.mongodb.com/docs/manual/core/aggregation-pipeline/> — MongoDB aggregation pipeline and limitations.

---
*Pitfalls research for: reporting UI + presets + CSV export (attendance domain)*
*Researched: 2026-04-13*
