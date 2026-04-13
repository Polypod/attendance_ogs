# ROADMAP: Attendance OGS

**Created:** 2026-04-13
**Granularity:** standard

## Phases

- [x] **Phase 1: Secure Raw Reporting** - Rapportsida + report-API för rådata med RBAC, datumintervall, fältfilter och server-side paginering.
- [x] **Phase 2: Aggregated Reporting** - Agg-läge med standard-grupperingar och nyckeltal, samt växling mellan rå/agg.
- [ ] **Phase 3: Column, Sort & Selection Controls** - Kolumn visa/dölj, sortering (klick på rubrik), global fri-text-sök och förbättrade multi-val.
- [ ] **Phase 4: Presets (Private + Shared)** - Spara/återanvänd presets server-side med delning, policy och versionering.
- [ ] **Phase 5: CSV Export (Streaming + Safe)** - CSV-export som matchar vyn, streamar stora dataset och skyddar mot CSV-injektion.

## Phase Details

### Phase 1: Secure Raw Reporting
**Goal**: Admin och instruktörer kan öppna rapportsidan och se rådata (en rad per närvaro-registrering) med stabil filtrering och paginering.
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, RPT-02, QRY-01, QRY-02, QRY-05
**Success Criteria** (what must be TRUE):
  1. ADMIN och INSTRUCTOR kan komma åt rapportsidan; andra roller nekas åtkomst.
  2. Rådata-läget visar en tabell med en rad per närvaro-registrering.
  3. Användaren kan filtrera på datumintervall (från–till) enligt en konsekvent och dokumenterad tidszonsregel.
  4. Användaren kan filtrera minst på student, instruktör, klass/pass och status och resultatet uppdateras korrekt.
  5. Resultat listas med server-side paginering (inkl. total/antal) så att stora datamängder hanteras stabilt.
**Plans**: 01-01, 01-02
**UI hint**: yes

### Phase 2: Aggregated Reporting
**Goal**: Användaren kan växla till aggregerat läge och se standard-summeringar med nyckeltal.
**Depends on**: Phase 1
**Requirements**: RPT-01, RPT-03, RPT-04, RPT-06
**Success Criteria** (what must be TRUE):
  1. Användaren kan växla mellan Rådata och Aggregerat läge.
  2. Aggregerat läge erbjuder standard-grupperingar: student, instruktör, pass/session och klass.
  3. Aggregerat läge visar minst nyckeltalen antal närvarande och total antal registreringar.
  4. Aggregerade resultat respekterar samma filter/datumintervall som rapportens query.
  5. Filtret Class schedule stödjer multi-val av ett eller flera tillfällen (sessions).
**Plans**: TBD
**UI hint**: yes

### Phase 3: Column, Sort & Selection Controls
**Goal**: Användaren kan anpassa tabellen (kolumner/sort/sök) och urval (multi-val) utan att tappa backend-konsistens.
**Depends on**: Phase 2
**Requirements**: RPT-05, QRY-03, QRY-04, QRY-06, QRY-07
**Success Criteria** (what must be TRUE):
  1. Användaren kan visa/dölja kolumner i tabellen.
  2. Användaren kan sortera på valda kolumner (server-side när relevant) och sorteringen återspeglas korrekt i resultatet.
  3. Användaren har global fri-text-sök som söker inom ett definierat fältset (minst namn/klass) och kan kombineras med övriga filter.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Presets (Private + Shared)
**Goal**: Användaren kan spara och återanvända rapportvyer/presets (privata och delade) på ett säkert och robust sätt.
**Depends on**: Phase 3
**Requirements**: PRS-01, PRS-02, PRS-03, PRS-04, PRS-05, PRS-06
**Success Criteria** (what must be TRUE):
  1. Användaren kan spara en preset som innehåller: vy-läge, valda kolumner, sortering, filter, gruppering och nyckeltal.
  2. Presets lagras server-side per användare, kan återanvändas mellan enheter och användaren kan lista/uppdatera/radera sina egna presets.
  3. Presets kan markeras som delade (globala) och andra användare kan se och använda delade presets.
  4. Behörighetsmodell för delade presets är tydlig och förhindrar otillåten skapande/ändring/radering.
  5. Presets är versionerade (t.ex. schemaVersion) och valideras vid inläsning.
**Plans**: TBD
**UI hint**: yes

### Phase 5: CSV Export (Streaming + Safe)
**Goal**: Användaren kan exportera CSV som exakt matchar rapportvyn och fungerar även för stora datamängder.
**Depends on**: Phase 4
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**Success Criteria** (what must be TRUE):
  1. Användaren kan exportera CSV för hela filtrerade resultatet med de kolumner som är aktiva i vyn.
  2. CSV-export använder samma query-definition som tabellen (ingen mismatch mellan vy och export).
  3. CSV-export är robust för större datamängder (server-side streaming/backpressure).
  4. CSV-export skyddar mot formel-/CSV-injektion i vanliga kalkylprogram.
**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Secure Raw Reporting | 2/2 | Complete | 2026-04-13 |
| 2. Aggregated Reporting | 0/TBD | Complete | 2026-04-13 |
| 3. Column, Sort & Selection Controls | 0/TBD | Not started | - |
| 4. Presets (Private + Shared) | 0/TBD | Not started | - |
| 5. CSV Export (Streaming + Safe) | 0/TBD | Not started | - |
