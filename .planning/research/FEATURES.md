# Feature Research

**Domain:** Rapporterings-UI för närvarosystem (karateklubb)
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Två lägen: **Rådata** + **Aggregerat** | Användare behöver både detaljgranskning och överblick | MEDIUM | Rådata = en rad per registrering. Aggregerat = fördefinierade grupperingar/nyckeltal. |
| Datumintervall-filter (”från–till”) | Rapporter handlar nästan alltid om perioder | MEDIUM | Tidszon + ”daggräns” måste vara konsekvent (server- vs klienttolkning). |
| Fältfilter per kolumn | Standard i alla moderna rapporttabeller | MEDIUM | Stöd för enum-filter (status), relationsfilter (klass/elev/instruktör), multi-select där relevant. |
| Sortering per kolumn (inkl. sekundär sort) | Förväntat för att hitta topp/botten | LOW | Server-side sort vid stora dataset; lås sort på beräknade kolumner om de inte kan sorteras korrekt. |
| Global fri-text-sök | Snabbt att hitta elev/klass utan att bygga filter | MEDIUM | Definiera vilka fält som ingår (t.ex. elevnamn, klassnamn). Undvik ”sök allt” om det blir dyrt. |
| Kolumnhantering: visa/dölj + ordning | Alla vill kunna fokusera på ”sin” vy | MEDIUM | Spara per vy/preset. Undvik att exportera dolda kolumner. |
| Paginering / ”load more” | Dataset blir snabbt stora | MEDIUM | Server-side paginering. Visa total träffar om billigt; annars ”ungefär” eller ”>N”. |
| Snabba standard-grupperingar (agg) | Användare vill inte bygga egna pivots | MEDIUM | Minst: per student, per instruktör, per pass/session, per klass. |
| Grundnyckeltal i agg-läge | Summeringar utan nyckeltal känns meningslöst | LOW | V1 enligt PROJECT.md: antal närvarande + total antal registreringar. |
| CSV-export av filtrerat resultat (”synliga värden”) | Vanligt arbetsflöde: vidare i Excel/Sheets | HIGH | Kräver ofta server-side export/streaming för stora mängder. Exporten måste matcha aktiv kolumnuppsättning. |
| Sparade vyer/presets (privata) | Återanvändning mellan dagar/enheter | MEDIUM | Preset inkluderar: läge, kolumner, sort, filter, gruppering, nyckeltal. |
| Delade presets (teamstandard) | Konsistens inom klubben och onboarding | MEDIUM | Behörighet: vem får skapa/ändra delade? Versionera eller ”kopiera till egen” för att undvika att bryta andra. |
| Rollbaserad åtkomst (admin + instruktör) | Rapporter innehåller persondata | LOW | Reuse befintlig RBAC. Logga exporthändelser vid behov. |
| Stabil, ”teacher-friendly” UX (surfplatta) | Primärt användarscenario enligt PROJECT.md | MEDIUM | Stora tryckytor, tydliga tomlägen, undvik små filter-popovers som är svåra på touch. |
| Tydliga fel-/tomlägen + laddningstillstånd | Användaren måste förstå ”varför ser jag inget?” | LOW | Ex: ”Inga resultat för valt datumintervall”, ”Du saknar behörighet”, ”Export pågår”. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Drill-down från agg → rådata (”klicka på en grupp och se raderna”) | Gör agg-läge granskningsbart och ökar förtroende | MEDIUM | Implementera som att agg-raden genererar ett filter som öppnar rådata med samma period/urval. |
| Period-jämförelse (t.ex. ”denna månad vs förra”) | Snabb trendanalys utan export | MEDIUM | Kräver tydliga definitioner (kalendermånad/vecka) och normalisering. |
| Metriker som ”närvarograd”, ”streak”, ”unika deltagare” | Mer värde än rena counts | MEDIUM/HIGH | Behöver definierade nämnare (planerade pass? registrerade elever? valbara). |
| ”Data quality”-indikatorer i rapporter | Fångar fel i underlaget tidigt | MEDIUM | Ex: elever utan kategori/bälte, pass utan instruktör, dubbla registreringar. |
| Snabbfilterchips (t.ex. ”senaste 7 dagar”, ”endast frånvaro”) | Mindre friktion för vanliga frågor | LOW | Kompletterar fältfilter; bör vara förutsägbara och enkla att nollställa. |
| Preset-delning via länk + kopiera/klona | Enkelt att sprida standardvyer | MEDIUM | Undvik att länken blir en ”hemlig nyckel” som kringgår RBAC; kräver inloggning. |
| Export som bakgrundsjobb med notifiering | Export funkar även för stora mängder | HIGH | UI: ”Export startad” → senare hämtning. Backend: kö, status, TTL. |
| ”Explain this number” (förklaring av agg-definition) | Minskar tolkningstvister i klubben | LOW/MEDIUM | Ex: tooltip: vilka statuser räknas som närvarande, vilken tidszon, vilka filter aktiva. |
| Favoriter/”pin” för de 3 vanligaste presets | Snabb åtkomst på mobilen | LOW | Små UX-vinster, hög användbarhet för instruktörer. |
| Lokaliserade datum/termer (sv/en) | Färre missförstånd, bättre adoptionsgrad | LOW | Rapporter är extra känsliga för datumformat och begrepp. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| ”Bygg din egen pivot/BI” (fri pivot builder) | Känns flexibelt och ”proffsigt” | Exploderar scope, kräver semantiskt lager, svår support | Fördefinierade grupperingar + ev. ett fåtal valbara group-by i v2. |
| Diagram/BI-dashboard i v1 | ”Det ser snyggt ut” | Tar fokus från korrekt data, kräver fler beslut (axlar, normalisering) | Lägg som v2+ när tabell/agg är stabilt. |
| Klient-side filtrering av hela datasetet | Snabbt att bygga initialt | Skalar dåligt, tungt på surfplatta, risk för att PII laddas i onödan | Server-side filtrering/paginering + index i DB. |
| Godtyckliga ad-hoc SQL/JSON queries i UI | Power users vill ha full kontroll | Hög säkerhetsrisk, svårt att säkra/limita, skapar supportbörda | Avgränsad query-modell via filter/sort + admin-only ”debug export” i backend vid behov. |
| Excel/PDF-export som ”måste” i v1 | Upplevs som mer officiellt än CSV | Mycket mer underhåll (format, layout, teckenkodning) | CSV i v1; utvärdera Excel (XLSX) först när verkligt behov finns. |
| Realtidsuppdatering (live refresh) | ”Alltid uppdaterat” | Komplexitet utan tydlig nytta i historiska rapporter | Manuellt refresh + tydlig ”senast uppdaterad” om relevant. |
| Delade presets utan styrning (alla kan ändra allt) | ”Enklast” | Leder till att standardvyer plötsligt ändras för alla | Ägarskap + behörighet (t.ex. admin äger delade) och/eller ”publicera ny version”. |

## Feature Dependencies

```
Server-side filtrering/sort/paginering
    └──requires──> Rapporterings-API med stabil query-modell
                       └──requires──> Indexering/optimering i DB för vanliga filter

Aggregerat läge
    └──requires──> Server-side aggregation pipelines (eller pre-aggregation)

CSV-export (hela filtrerade resultatet)
    └──requires──> Server-side export/streaming
                       └──enhances──> Export som bakgrundsjobb (för stora mängder)

Delade presets
    └──requires──> RBAC + preset-ägarskap/behörigheter

Drill-down agg → rådata
    └──requires──> Att agg-rader kan översättas till rådatafilter (entydiga dimensioner)

Global sök
    └──conflicts──> Obegränsad "sök i alla fält" (dyrt/oklart)
```

### Dependency Notes

- **Server-side filtrering/sort/paginering kräver Rapporterings-API:** UI:t blir snabbt långsamt och inkonsekvent om logik dupliceras på klienten.
- **Aggregerat läge kräver server-side aggregation:** Att aggregera på klienten kräver att du först hämtar alla rader, vilket inte skalar.
- **CSV-export kräver ofta server-side streaming:** För att undvika timeouts och minnesproblem när exporten kan bli stor.
- **Delade presets kräver RBAC + ägarskap:** Annars uppstår ”vem ändrade min vy?”-problem och oavsiktliga förändringar.
- **Global sök konflikterar med otydlig sökscope:** Definiera fält (namn/klass) och gör det förutsägbart.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Rådata-tabell med server-side paginering, fältfilter, sort, global sök — kärnnytta för att hitta och exportera data
- [ ] Aggregerat läge med standard-grupperingar + grundnyckeltal — kärnnytta för snabb överblick
- [ ] Kolumnhantering (visa/dölj) som påverkar både vy och export — matchar ”synliga värden”
- [ ] Presets: privata + delade (med enkel behörighetsmodell) — återanvändning och standardisering
- [ ] CSV-export av hela filtrerade resultatet (synliga kolumner) — praktiskt arbetsflöde

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Drill-down agg → rådata — när användare vill verifiera summeringar utan export
- [ ] Export som bakgrundsjobb med notifiering — när exports börjar time:a ut eller bli stora
- [ ] Period-jämförelse — när rapporter används för uppföljning över tid
- [ ] Data-quality indikatorer — när man vill öka datatillit och fånga felregistreringar

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Valbar group-by/”semi-pivot” (begränsad) — först när standardgrupperingar inte räcker
- [ ] Excel (XLSX) export — först när CSV inte räcker för målgruppen
- [ ] Diagram/BI-visualisering — efter att definitioner/nyckeltal är stabila

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Rådata-tabell: filter/sort/paginering | HIGH | MEDIUM | P1 |
| Aggregerat läge: standardgrupperingar + nyckeltal | HIGH | MEDIUM | P1 |
| Kolumn visa/dölj (inkl. export) | HIGH | MEDIUM | P1 |
| Presets privata + delade | HIGH | MEDIUM | P1 |
| CSV-export (hela filtrerade resultatet) | HIGH | HIGH | P1 |
| Global fri-text-sök | MEDIUM | MEDIUM | P2 |
| Drill-down agg → rådata | MEDIUM/HIGH | MEDIUM | P2 |
| Export som bakgrundsjobb | MEDIUM | HIGH | P2 |
| Period-jämförelse | MEDIUM | MEDIUM | P3 |
| Data quality-indikatorer | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A (Spreadsheets: Excel/Sheets) | Competitor B (”typiskt medlems-/klubbadmin-system”) | Our Approach |
|---------|-------------------------------------------|-----------------------------------------------------|-------------|
| Rådata + egna filter/sort | Mycket starkt när datan väl är exporterad | Ofta begränsat eller ”fast” | Bygg bra tabell i appen så export inte är enda vägen. |
| Aggregeringar/nyckeltal | Kräver manuellt arbete (pivot/formler) | Ofta enkla sammanställningar | Fördefinierade summeringar som matchar karate-skolans behov. |
| Sparade vyer/presets | Möjligt via delade ark/flikar | Varierar | Presets i DB: privata + delade standardvyer. |
| CSV-export | Standard | Vanligt | Export ”synliga värden” och hela filtrerade datasetet. |
| Drill-down och spårbarhet | Kräver manuellt arbete | Ofta saknas | Drill-down från agg till rådata med samma filter. |

## Sources

- `.planning/PROJECT.md` (krav och scope för rapportsidan)
- Praktiska UX-mönster från datagrids/rapporttabeller (generellt branschmönster; ej projektspecifika externa källor)

---
*Feature research for: Rapporterings-UI för närvarosystem*
*Researched: 2026-04-13*
