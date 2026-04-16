# Requirements: Attendance OGS

**Defined:** 2026-04-13
**Core Value:** Admin och instruktörer kan snabbt få fram korrekt närvarodata (rådata eller summeringar), återanvända sparade vyer och exportera resultatet.

## v1 Requirements

### Security & Access

- [x] **SEC-01**: Endast rollerna **ADMIN** och **INSTRUCTOR** kan komma åt rapportsidan och rapport-API:t
- [x] **SEC-02**: Instruktörer kan se all data i v1 (ingen “bara egna pass”-begränsning)

### Reporting Views (Rådata + Aggregerat)

- [x] **RPT-01**: Användaren kan växla mellan **Rådata** och **Aggregerat** läge
- [x] **RPT-02**: Rådata-läget visar en tabell med en rad per närvaro-registrering
- [x] **RPT-03**: Aggregerat läge erbjuder en **valbar aggregeringsnivå** (standard-grupperingar): **student**, **instruktör**, **tillfälle (pass/session)**, **klass**
- [x] **RPT-04**: Aggregerat läge visar minst nyckeltalen **antal närvarande** och **total antal registreringar**
- [x] **RPT-05**: Användaren kan visa/dölja kolumner i listan
- [x] **RPT-06**: Filtret **Sessions (Class schedule)** stödjer multi-val av **enskilda tillfällen** (classScheduleId + datum), inte bara ”alla liknande” via ett schedule-id

### Query (Filter, Sort, Sök)

- [x] **QRY-01**: Användaren kan filtrera på **datumintervall (från–till)** med en konsekvent och dokumenterad tidszonsregel
- [x] **QRY-02**: Användaren kan filtrera per fält (minst: student, instruktör, klass/pass, status)
- [x] **QRY-03**: Användaren kan sortera på valda kolumner genom att klicka på kolumnrubriken (server-side när relevant)
- [x] **QRY-04**: Användaren har global fri-text-sök som söker inom ett definierat fältset (minst namn/klass)
- [x] **QRY-05**: Resultat listas med server-side paginering så att stora datamängder hanteras stabilt
- [x] **QRY-06**: Det ska vara möjligt att välja flera studenter, förslagsvis via checkbox
- [x] **QRY-07**: Det ska vara möjligt att välja flera instruktörer, förslagsvis via checkbox

### Presets (Privata + Delade)

- [ ] **PRS-01**: Användaren kan spara en preset som innehåller: vy-läge, valda kolumner, sortering, filter, gruppering och nyckeltal
- [ ] **PRS-02**: Presets lagras server-side per användare och kan återanvändas mellan enheter
- [ ] **PRS-03**: Användaren kan lista, uppdatera och radera sina egna presets
- [ ] **PRS-04**: Presets kan markeras som **delade** (globala); andra användare kan se och använda delade presets
- [ ] **PRS-05**: Det finns en tydlig behörighetsmodell för delade presets (vem får skapa/ändra/radera)
- [ ] **PRS-06**: Presets är versionerade (t.ex. `schemaVersion`) och valideras vid inläsning

### Export (CSV)

- [ ] **EXP-01**: Användaren kan exportera CSV för hela filtrerade resultatet med de kolumner som är aktiva i vyn
- [ ] **EXP-02**: CSV-export använder samma query-definition som tabellen (ingen mismatch mellan vy och export)
- [ ] **EXP-03**: CSV-export är robust för större datamängder (server-side streaming/backpressure)
- [ ] **EXP-04**: CSV-export skyddar mot formel-/CSV-injektion i vanliga kalkylprogram

## v2 Requirements (Deferred)

### Reporting Enhancements

- **RPTX-01**: Drill-down från aggregerad rad till motsvarande rådatafilter
- **RPTX-02**: Fler nyckeltal (t.ex. närvaroprocent) med tydliga definitioner
- **RPTX-03**: Snabbfilterchips (t.ex. ”senaste 7 dagar”, ”endast frånvaro”)

### Export Enhancements

- **EXPX-01**: Export som bakgrundsjobb (kö + notifiering) för mycket stora exports
- **EXPX-02**: Excel/XLSX export

### Access Enhancements

- **SECX-01**: Valfri begränsning för instruktörer till ”egna pass/klasser”

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Pivot/BI-byggare (fri group-by/pivot) | Scope-explosion och hög komplexitet |
| Diagram/BI-dashboard i v1 | Kräver fler semantikbeslut; fokus på korrekt tabell/agg först |
| PDF-export i v1 | Underhållstungt; CSV räcker initialt |

## Traceability

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| RPT-01 | Phase 2 | Complete |
| RPT-02 | Phase 1 | Complete |
| RPT-03 | Phase 2 | Complete |
| RPT-04 | Phase 2 | Complete |
| RPT-05 | Phase 3 | Complete |
| RPT-06 | Phase 2 | Complete |
| QRY-01 | Phase 1 | Complete |
| QRY-02 | Phase 1 | Complete |
| QRY-03 | Phase 3 | Complete |
| QRY-04 | Phase 3 | Complete |
| QRY-05 | Phase 1 | Complete |
| QRY-06 | Phase 3 | Complete |
| QRY-07 | Phase 3 | Complete |
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
*Last updated: 2026-04-15 after Phase 3 completion*
