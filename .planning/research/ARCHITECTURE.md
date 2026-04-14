# Architecture Research

**Domain:** Reporting (rådata + aggregerat) för närvarosystem
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js App Router)                     │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐    ┌───────────────────────────────────────┐  │
│  │ /dashboard/reports     │    │ frontend/src/lib/api.ts               │  │
│  │ ReportsPage (client)   │───▶│ fetchWithAuth() → REST calls          │  │
│  └─────────────┬─────────┘    └───────────────────┬───────────────────┘  │
│                │                                   │                      │
└────────────────┼───────────────────────────────────┼──────────────────────┘
                 │                                   │
                 ▼                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Backend (Express + Mongoose)                    │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐    ┌───────────────────────────────────────┐  │
│  │ src/routes/reports*    │───▶│ src/controllers/ReportController.ts   │  │
│  │ src/routes/report...   │    │ HTTP only: validera + kalla service   │  │
│  └─────────────┬─────────┘    └───────────────────┬───────────────────┘  │
│                │                                   │                      │
│     authorize(ADMIN, INSTRUCTOR)                   ▼                      │
│  ┌───────────────────────┐    ┌───────────────────────────────────────┐  │
│  │ Joi validateRequest() │───▶│ src/services/ReportService.ts          │  │
│  │ (query/preset DTO)    │    │ Bygger aggregation pipeline + paging    │  │
│  └───────────────────────┘    └───────────────────┬───────────────────┘  │
│                                                    │                      │
│                                                    ▼                      │
│                               ┌───────────────────────────────────────┐  │
│                               │ src/services/ReportPresetService.ts    │  │
│                               │ CRUD presets + access policy           │  │
│                               └───────────────────┬───────────────────┘  │
└────────────────────────────────────────────────────┼──────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                                MongoDB                                    │
├───────────────────────────────────────────────────────────────────────────┤
│  Collections: Attendance, Student, ClassSchedule, Class, User, ReportPreset│
│  Query: find()/aggregate() + $lookup + $group + $facet + cursor()         │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
| --------- | -------------- | ---------------------- |
| ReportsPage | UI för rå/agg, filter/sort, kolumner, presets, export | Next.js client component + shadcn table |
| API client | Standardiserar anrop, injectar Bearer-token | `frontend/src/lib/api.ts` |
| ReportController | Tar emot query/export, sätter headers, svarar JSON/CSV | Express controller (ingen affärslogik) |
| ReportService | Översätter ReportQuery → Mongo filter/pipeline, paging, sort, kolumn-projection | Mongoose `aggregate()` + pipeline builder |
| ReportPresetService | Skapa/lista/uppdatera/radera presets med policy (privat/delad) | Mongoose model CRUD + access checks |
| ReportPresetModel | Lagrar preset-definitioner per användare + delad flag | Ny Mongoose model |

## Recommended Project Structure

```text
src/
├── controllers/
│   ├── ReportController.ts              # Query + export endpoints
│   └── ReportPresetController.ts        # Preset CRUD
├── services/
│   ├── ReportService.ts                 # Raw + aggregated query engine
│   ├── ReportPresetService.ts           # Preset CRUD + access policy
│   └── reportQuery/                     # (valfritt) pipeline builders
│       ├── reportQueryTypes.ts          # (alt: lägg i src/types/interfaces.ts)
│       ├── buildMatch.ts
│       ├── buildPipelineRaw.ts
│       ├── buildPipelineAgg.ts
│       └── csvExport.ts
├── models/
│   └── ReportPreset.ts                  # Ny collection
├── routes/
│   ├── reportRoutes.ts                  # /api/reports/query + /export
│   └── reportPresetRoutes.ts            # /api/report-presets
├── types/
│   ├── interfaces.ts                    # Report DTOs/Enums (om man följer befintlig norm)
│   └── validation.ts                    # Joi schemas (alternativt nära routes)
└── middleware/
    └── validation.ts                    # validateRequest(schema) (befintlig)

frontend/src/
├── app/
│   └── dashboard/
│       └── reports/
│           └── page.tsx                 # Reports page
├── components/
│   └── reports/
│       ├── ReportsTable.tsx             # Tabell + pagination
│       ├── ReportsToolbar.tsx           # filter/sort/search/export
│       ├── ColumnPicker.tsx             # visa/dölj kolumner
│       └── PresetMenu.tsx               # spara/ladda/dela
├── lib/
│   └── api.ts                           # fetchWithAuth (befintlig)
└── types/
    └── reports.ts                       # Frontend-typer för query state
```

### Structure Rationale

- **Separat reports-modul**: Nuvarande `AttendanceService.generateAttendanceReports()` är en bra referens, men den nya rapportsidan kräver ett mer generellt query-API (rå + flera aggregat), så ett eget `ReportService` minskar risk för en “god service” som växer okontrollerat.
- **Preset som egen model**: Presets är användar- och UI-specifika (kolumner/sort/filter/gruppering). Att lagra dem som dokument i MongoDB ger enkel synk mellan enheter och stöd för “delade” presets.
- **Whitelisting**: För filtrering/sort/kolumner måste backend kontrollera tillåtna fält och operatorer; annars finns risk för NoSQL-injection och oönskade fältläckor.

## Implementation / Build Order

Rekommenderad ordning för att minimera omtag och möjliggöra tidig testning:

1. **Definiera Query-DSL + preset-schema (typer)**
   - `ReportMode = 'raw' | 'aggregate'`
   - `ReportView = 'attendance'` (om fler rapporttyper kan komma senare)
   - `ReportColumnKey` (whitelist) och `ReportFilter` (whitelist + operatorer)

2. **Skapa `ReportPreset`-model**
   - Minimal schema + index för `(owner_user_id, is_shared, scope)`.

3. **Implementera `ReportPresetService` + endpoints**
   - UI kan tidigt testa “spara och ladda vy”, även om report-query ännu är rudimentär.

4. **Implementera `ReportService.query()` (raw mode) med paging + sort + filter**
   - Börja med de viktigaste fälten: datumintervall, status, category, student-id, class-id, recorded_by.

5. **Lägg till `ReportService.query()` (aggregate mode) med standard-grupperingar**
   - Grupp: student, instruktör, pass/session (class_schedule), klass.
   - Nyckeltal: count per status + total.

6. **Implementera CSV export server-side (streaming)**
   - Bygg på samma query-DSL och samma whitelist-kolumnlogik.

7. **Frontend ReportsPage (MVP UI):**
   - Tabell med två flikar: “Rådata” och “Aggregerat”.
   - Filter + sort + sök + kolumnval.

8. **Frontend presets + delning + export-knapp**
   - Koppla mot preset-endpoints.
   - CSV export ska exportera *hela filtrerade resultatet* och bara aktiva kolumner.

## API Endpoints (förslag)

**Reports (data):**

- `POST /api/reports/query`
  - Body: `ReportQueryDto`
  - Return: `{ success: true, data: { items: any[]; total: number } }`
  - Syfte: tabellresultat (rå eller aggregerat) med pagination.

- `POST /api/reports/export`
  - Body: `ReportQueryDto` (samma som `/query`, men paging ignoreras)
  - Return: `text/csv` stream (attachment)
  - Syfte: exportera *hela filtrerade resultatet* med valda kolumner.

**Presets (vy-inställningar):**

- `GET /api/report-presets?view=attendance`
  - Return: privata presets (owner = req.user) + delade presets.

- `POST /api/report-presets`
  - Body: `{ name, is_shared, view, definition: ReportQueryDto | ReportPresetDefinition }`

- `PUT /api/report-presets/:presetId`
  - Policy: owner kan ändra privat; delad kräver admin (rekommenderat).

- `DELETE /api/report-presets/:presetId`
  - Policy: owner eller admin.

**Bakåtkompatibilitet (befintligt):**

- `GET /api/attendance/reports/:dateRange`
  - Kan ligga kvar som “legacy report” tills reports-sidan går på nya API:t.

## Architectural Patterns

### Pattern 1: Whitelisted Report Query DSL (säker query-bygge)

**What:** Skicka ett begränsat JSON-format (DTO) från frontend som backend översätter till Mongo match/sort/projection via en whitelist-mapp.

**When to use:** Alltid när UI har dynamiska filter/sort/kolumner.

**Trade-offs:**

- Fördel: Förhindrar query-injection och “field path spelunking”.
- Fördel: Stabilt kontrakt mellan UI och backend.
- Nackdel: Kräver explicit mapping och lite mer kod än “skicka direkt Mongo query”.

**Example:**

```typescript
export type ReportMode = 'raw' | 'aggregate';

export type ReportFilterOp = 'eq' | 'in' | 'contains' | 'gte' | 'lte';

export type ReportFilter = {
  key:
    | 'date'
    | 'status'
    | 'category'
    | 'student_id'
    | 'class_schedule_id'
    | 'class_id'
    | 'instructor'
    | 'recorded_by'
    | 'q';
  op: ReportFilterOp;
  value: string | string[];
};

export type ReportSort = { key: string; dir: 'asc' | 'desc' };

export interface ReportQueryDto {
  mode: ReportMode;
  view: 'attendance';
  filters: ReportFilter[];
  sort?: ReportSort[];
  columns: string[]; // ReportColumnKey[] i praktiken
  page?: number;
  pageSize?: number;
}

const RAW_FIELD_MAP: Record<string, string> = {
  date: 'date',
  status: 'status',
  category: 'category',
  recorded_by: 'recorded_by'
  // OBS: student/class fält byggs via $lookup och $addFields
};
```

### Pattern 2: Pipeline builder + `$facet` för “items + total”

**What:** Bygg en aggregation pipeline som (a) joinar nödvändiga collections via `$lookup`, (b) applicerar `$match` baserat på whitelist, (c) paginerar och returnerar `items` + `total` i ett anrop via `$facet`.

**When to use:** Raw-tabell och aggregerad tabell där UI behöver pagination.

**Trade-offs:**

- Fördel: En roundtrip och konsekvent total.
- Fördel: Undviker N+1 populates.
- Nackdel: Aggregations kan bli dyra utan index/avgränsning.

**Example:**

```typescript
const pipeline = [
  { $match: { /* date/status/category etc */ } },
  { $lookup: { from: 'students', localField: 'student_id', foreignField: '_id', as: 'student' } },
  { $unwind: '$student' },
  { $lookup: { from: 'classschedules', localField: 'class_schedule_id', foreignField: '_id', as: 'schedule' } },
  { $unwind: '$schedule' },
  { $lookup: { from: 'classes', localField: 'schedule.class_id', foreignField: '_id', as: 'class' } },
  { $unwind: '$class' },

  // (valfritt) normalisera fält för sort/sök
  { $addFields: { student_name: '$student.name', class_name: '$class.name', instructor: '$class.instructor' } },

  { $facet: {
      items: [
        { $sort: { date: -1 } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
        { $project: { /* projection baserat på columns */ } }
      ],
      total: [ { $count: 'count' } ]
    }
  }
];
```

### Pattern 3: Streaming CSV export (server-side, “hela filtrerade resultatet”)

**What:** Export ska inte bygga hela resultatet i minnet och inte kräva att klienten “bläddrar igenom” alla sidor. Använd aggregation cursor och skriv CSV rad-för-rad.

**When to use:** Alltid när export kan bli större än enstaka sidor.

**Trade-offs:**

- Fördel: Minneseffektivt och robust.
- Fördel: Samma filter/sort/columns som vyn.
- Nackdel: Kräver lite mer omsorg kring backpressure och korrekt CSV-escaping.

**Example:**

```typescript
// Mongoose stödjer aggregation cursors för stora resultat
const cursor = AttendanceModel
  .aggregate(exportPipeline)
  .cursor({ batchSize: 1000 });

res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');

res.write(columns.join(',') + '\n');

for await (const row of cursor) {
  res.write(serializeCsvRow(row, columns) + '\n');
}

res.end();
```

## Data Flow

### Request Flow

```text
[User justerar filter/sort/kolumner/preset]
    ↓
[ReportsPage state → ReportQueryDto]
    ↓
POST /api/reports/query
    ↓
ReportController → ReportService (build match/pipeline)
    ↓
MongoDB aggregate() → { items, total }
    ↓
JSON response → UI renderar tabell
```

### State Management

```text
(React state / useReducer)
    ↓
ReportQueryDto (single source of truth för vyn)
    ↓
Persistens:
- “Spara preset” → POST /api/report-presets
- “Ladda preset” → GET /api/report-presets
```

### Key Data Flows

1. **Raw report:** Attendance rows + `$lookup` för student/class/schedule, filter/sort, kolumn-projection.
2. **Aggregated report:** Samma basmatch + join, sedan `$group` enligt vald standard-gruppering (student/instruktör/pass/klass).
3. **CSV export:** Samma query (utan paging) + streaming till response.

## Scaling Considerations

| Scale | Architecture Adjustments |
| ----- | ------------------------ |
| 0-1k users / små datamängder | Monolit + aggregation pipelines räcker. CSV kan genereras on-demand. |
| 1k-100k users / växande data | Lägg index på Attendance (date/status/category/student_id/class_schedule_id). Undvik “contains” regex på joinade fält. Inför strikt paging i UI. |
| 100k+ / stor historik | Överväg denormaliserade “report fields” (student_name, class_name, instructor) på Attendance, eller en materialiserad “ReportFact” collection per dag/pass. |

### Scaling Priorities

1. **First bottleneck:** fri-text-sök (`q`) över joinade fält (regex) + stora date ranges.
   - Mitigation: tvinga datumintervall, begränsa sök till vissa fält, index/denormalisering.

2. **Second bottleneck:** CSV export av stora dataset.
   - Mitigation: streaming cursor + batchSize, `allowDiskUse(true)` för aggregation, rate limit per user.

## Anti-Patterns

### Anti-Pattern 1: “Skicka Mongo-query direkt från frontend”

**What people do:** Låter UI skicka fritt `{ $match: ... }` eller field paths (t.ex. `"student.name"`) och stoppar in i pipeline.

**Why it's wrong:** Öppnar för NoSQL-injection, oavsiktliga `$`-operatorer, och dataläckor via okontrollerad projection.

**Do this instead:** Använd en whitelistad DSL (`ReportFilter`, `ReportColumnKey`) och bygg match/pipeline i backend.

### Anti-Pattern 2: CSV export i klienten via “hämta alla sidor”

**What people do:** Laddar page 1..N i webbläsaren och bygger CSV lokalt.

**Why it's wrong:** Långsamt, bräckligt, risk för minnesproblem och timeouts, och ger olika resultat beroende på paging.

**Do this instead:** Server-side export med streaming cursor och exakt samma query som vyn.

### Anti-Pattern 3: N+1 populates per rad

**What people do:** Hämtar `Attendance.find()` och gör separata queries per row för student/class.

**Why it's wrong:** Exploderar i antal DB-queries och blir långsamt snabbt.

**Do this instead:** `$lookup`-baserad aggregation (eller en enda `.populate()`-query utan per-rad loop) och projection baserad på kolumnval.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
| ------- | ------------------- | ----- |
| (none) | — | Rapporter är intern DB-query + export. |

### Internal Boundaries

| Boundary | Communication | Notes |
| -------- | ------------- | ----- |
| Reports UI ↔ Backend API | REST (`POST /api/reports/query`, `POST /api/reports/export`) | Använd samma `ReportQueryDto` för båda. |
| Presets UI ↔ Preset API | REST CRUD | Policy: privat alltid, delad endast om `is_shared=true` och behörighet. |
| ReportService ↔ MongoDB | Mongoose `aggregate()` + cursor | Mongoose castar inte pipeline stages automatiskt → manuellt `ObjectId` där det behövs. |
| Reports ↔ Auth | `authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR)` | Samma åtkomst som befintliga rapporter. |
| Reports ↔ Config | Använd befintlig `/api/config` för kategorilistor | Undvik ny “metadata endpoint” om det inte behövs. |

## Sources

- MongoDB Manual — Aggregation Pipeline: <https://www.mongodb.com/docs/manual/core/aggregation-pipeline/>
- Mongoose docs — Aggregate + cursor(): <https://mongoosejs.com/docs/api/aggregate.html>
- Next.js docs — App Router: <https://nextjs.org/docs/app>

---
*Architecture research for: reporting i attendance_ogs*
*Researched: 2026-04-13*
