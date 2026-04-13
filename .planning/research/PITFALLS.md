# Pitfalls Research

**Domain:** Rapporterings-UI (rådata + aggregerat) + presets + CSV-export för närvarosystem
**Researched:** 2026-04-13
**Confidence:** MEDIUM

> **Fas-legend (för roadmap-mappning):**
> - **Fas R1 — Report contract & semantik:** definiera fält, tidszon, “närvarande”-definitioner, vilka dimensioner som är tillåtna.
> - **Fas R2 — Backend query + säkerhet:** API-kontrakt, whitelists, validering, RBAC, index-plan, aggregeringar.
> - **Fas R3 — Presets (persistens + delning):** datamodell, ägarskap, versionering/migration, delningsregler.
> - **Fas R4 — UI (state + tabell):** filter/sort/kolumnhantering, mobil/touch UX, sync mellan URL↔state↔preset.
> - **Fas R5 — Export (CSV):** “synliga värden”, streaming, avbrott/backpressure, injection-skydd, audit.
> - **Fas R6 — Verifiering & hårdning:** prestanda/test, correctness, observability, regressionskydd.

## Critical Pitfalls

### Pitfall 1: Otydlig rapportsemantik (”Vad betyder siffran?”)

**What goes wrong:**
Användare får olika svar beroende på vy-läge, filterkombination eller tolkning (t.ex. ”närvarande” räknar ibland bara vissa statusar). Aggregerade totals känns ”fel” och tappar förtroende.

**Why it happens:**
Rapportfunktioner byggs ofta som UI-först (“lägg till filter + group-by”) utan att först definiera domänens mått, tidszon och normalisering.

**How to avoid:**
- Definiera en liten “report contract”: fält, datatyper, vilka statusar ingår i nyckeltal, och vilka standard-grupperingar som finns.
- Skriv ner tidszonregeln: *vilken zon används för datumintervall och dagsgränser?* (serverzon vs användarzon).
- Lägg in en tydlig “definition”-yta i UI (tooltip/sektion) som visar: aktiva filter + vad nyckeltalen betyder.

**Warning signs:**
- Frågor som “varför skiljer exporten från tabellen?” eller “varför är totalsumman annan än jag räknar manuellt?”
- Fler och fler specialfall i kod: “om groupBy==X och filter==Y så…”

**Phase to address:**
Fas R1 — Report contract & semantik

---

### Pitfall 2: Tidszon- och datumintervall-buggar (off-by-one-dagar)

**What goes wrong:**
Rapporter visar fel dag, missar sena pass, eller inkluderar/utesluter registreringar precis vid midnatt. Exporten matchar inte UI.

**Why it happens:**
Datumintervall implementeras i flera lager (frontend, backend, DB) och blandar lokala datum (”2026-04-13”) med timestamps utan tydlig normalisering.

**How to avoid:**
- Välj en canonical representation för filter: t.ex. skicka ISO-tidsstämplar med explicit tidszon/offset, eller skicka datum + explicit zon och låt backend expandera till [start,end).
- Standardisera intervall som *inklusive start, exklusiv slut* ($[from, to)$) för att undvika dubbeltolkning.
- Lägg testfall för gränser: midnatt, sommartidsskifte, och “sen kväll” pass.

**Warning signs:**
- Supportärenden kring “fel dag” eller “saknar gårdagens sista pass”.
- Man ser `new Date('YYYY-MM-DD')` i frontend (tolkas ofta som UTC på många plattformar) utan tydlig zon-hantering.

**Phase to address:**
Fas R1 — Report contract & semantik

---

### Pitfall 3: UI- och backendfilter driver isär (mismatch mellan “synligt” och “giltigt”)

**What goes wrong:**
UI tillåter filter/sort som backend inte stöder (eller tolkar annorlunda). Resultatet blir “tomma tabeller”, inkonsekventa exports, eller 500-fel vid vissa kombinationer.

**Why it happens:**
Filter byggs ad hoc i UI och backend tolkar query-parametrar som fria strängar. Ingen strikt, versionsbar query-modell.

**How to avoid:**
- Definiera en whitelista över filterbara/sorterbara fält per report-typ (rå vs agg).
- Validera alla filter i backend (Joi) och returnera 400 med begripligt fel vid ogiltiga kombinationer.
- Versionera query-kontraktet (minst implicit via “reportType”) så presets kan migreras.

**Warning signs:**
- Man “skickar igenom” `{ sortBy: req.query.sortBy }` direkt in i Mongo/Mongoose.
- “Det funkar i UI men exporten blir annorlunda” (export endpoint använder annan kodväg).

**Phase to address:**
Fas R2 — Backend query + säkerhet

---

### Pitfall 4: Presets blir sköra utan schema-version och migration

**What goes wrong:**
Efter en liten ändring (ny kolumn, omdöpt fält, ny groupBy) slutar gamla presets fungera, eller ger subtilt fel data. Delade presets kan “förstöra” för andra användare.

**Why it happens:**
Presets sparar “rå” tabell-state utan versionsfält och utan tydlig ägarskaps-/publiceringsmodell.

**How to avoid:**
- Spara presets med `schemaVersion` + `reportType` och en tydlig modell: `ownerUserId`, `isShared`, `name`, `state`.
- Vid laddning: validera och migrera state (best-effort) eller flagga som “behöver uppdateras”.
- För delade presets: använd “publicera”-flöde (t.ex. admin-only) eller “klona till egen” istället för att alla kan ändra samma.

**Warning signs:**
- Presets sparar bara en blob utan metadata.
- Nya kolumner bryter rendering (undefined access) när preset laddas.

**Phase to address:**
Fas R3 — Presets (persistens + delning)

---

### Pitfall 5: “CSV-export av synliga värden” implementeras som “exportera current page”

**What goes wrong:**
Användaren tror att exporten innehåller allt filtrerat resultat, men får bara första sidan/nuvarande page. Förtroendet rasar.

**Why it happens:**
Tabeller byggs med paginering; export kopplas till UI:s nuvarande data-array istället för att köra samma filter på serversidan.

**How to avoid:**
- Gör exporten till ett separat backend-endpoint som tar exakt samma filter/sort/kolumnval som vyn.
- I UI: visa tydligt “Exporterar alla X matchande rader” (om X finns) eller “Exporterar alla matchande rader”.
- Se till att exporten använder samma query-builder som tabellen (delad service).

**Warning signs:**
- Export-knappen serialiserar bara “currentRows”.
- Buggrapporter som “export saknar data jag ser i tabellen” eller tvärtom.

**Phase to address:**
Fas R5 — Export (CSV)

---

### Pitfall 6: Stora exports byggs utan streaming/backpressure → minnesdöd eller timeouts

**What goes wrong:**
CSV-export för större datumintervall kraschar (OOM), hänger, eller timear ut via proxy. API blir instabilt.

**Why it happens:**
Man genererar CSV genom att hämta alla rader till minnet och sedan `res.send(csvString)`; eller man skriver för snabbt till `res.write()` utan att respektera backpressure.

**How to avoid:**
- Streama exporten (cursor/iterator) och skriv rad för rad.
- Respektera backpressure/`drain` eller använd `stream.pipeline()`/`node:stream/promises`.
- Sätt realistiska gränser: max-datumspann för interaktiv export, eller implementera bakgrundsjobb senare om behövs.
- Beakta reverse proxy timeouts/buffering för långa svar.

**Warning signs:**
- “JavaScript heap out of memory” vid export.
- Export funkar lokalt men inte i prod (504, proxy buffers).

**Phase to address:**
Fas R5 — Export (CSV)

---

### Pitfall 7: CSV-injection (formel-injektion) via namn/klassfält

**What goes wrong:**
Om någon elev/klass/instruktörsnamn börjar med `=`, `+`, `-`, `@` kan Excel/Sheets tolka cellen som formel när CSV öppnas. Det kan i värsta fall leda till exfiltration eller andra attacker.

**Why it happens:**
CSV ses som “bara text” och exporten innehåller användargenererade fält utan sanering.

**How to avoid:**
- Sanera CSV-fält för spreadsheet-konsumtion: prefixa risk-prefix (`=`, `+`, `-`, `@`) enligt etablerad mitigation, och citera alltid fält.
- Dokumentera trade-off: sanering kan påverka maskinimport (men är rätt val om mål är Excel).

**Warning signs:**
- Exporter används rutinmässigt i Excel.
- Inga tester för att exporten hanterar “farliga” cellprefix.

**Phase to address:**
Fas R5 — Export (CSV)

---

### Pitfall 8: Aggregeringar i MongoDB blir dyra och svår-optimerade

**What goes wrong:**
Agg-läget blir långsamt eller instabilt, särskilt när man kombinerar många filter och group-by. Teamet börjar lägga logik i appservern och drar hem stora dataset istället.

**Why it happens:**
Man bygger en “generisk” aggregation pipeline som försöker stödja allt, utan att designa för index och utan att begränsa kombinationer.

**How to avoid:**
- Ha få, fördefinierade agg-varianter (en per standard-gruppering) och bygg pipeline explicit.
- Placera `$match` tidigt och `$project` för att minska payload.
- Säkerställ indexes som matchar vanligaste `$match` + `$sort`.
- Om pipeline kan bli stor: utvärdera `allowDiskUse` och/eller mer begränsade exportgränser.

**Warning signs:**
- Agg endpoints har lång tail-latency (p95/p99) och CPU spikes.
- Man använder `$lookup`/`populate` i stora volymer utan att mäta.

**Phase to address:**
Fas R2 — Backend query + säkerhet

---

### Pitfall 9: Delade presets blir en “IDOR”-yta (otillåten åtkomst via preset-id)

**What goes wrong:**
En användare kan läsa/ändra presets de inte ska se (t.ex. genom att gissa ID). Eller delade presets råkar läcka PII via kolumner som inte borde vara exporterbara.

**Why it happens:**
Preset-resurser behandlas som “ofarliga” och skyddas inte lika strikt som rapportdata.

**How to avoid:**
- Kör RBAC/ägarskapskontroller på preset CRUD: owner kan hantera egna, delade kräver explicit policy.
- Lagra endast state; bestäm på serversidan vilka kolumner som överhuvudtaget får användas i export.
- Logga och överväg audit för exporthändelser (åtminstone server-side logging).

**Warning signs:**
- Preset endpoints saknar auth-middleware.
- “shared=true” gör att alla kan skriva.

**Phase to address:**
Fas R3 — Presets (persistens + delning)

---

### Pitfall 10: “Global search” blir antingen för dyr eller för vag

**What goes wrong:**
Global fri-text-sök tar för lång tid (full collection scan), eller ger oväntade resultat (söker i för många/konstiga fält). Användaren litar inte på sök.

**Why it happens:**
Global search implementeras som “regex över allt” eller som eftertanke utan definierade fält.

**How to avoid:**
- Definiera exakt vilka fält som ingår (t.ex. studentnamn, klassnamn, instruktör).
- För rådata: överväg pre-indexerad sökbar field (t.ex. `searchText`) eller Mongo text index om det passar.
- Begränsa global search i agg-läge (ofta meningslöst).

**Warning signs:**
- Sök = `$or` med många regexer.
- Sök orsakar timeouts när dataset växer.

**Phase to address:**
Fas R2 — Backend query + säkerhet

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Klient-side filtrering/sortering på hela datasetet | Snabbt att bygga | Skalar dåligt, PII laddas i onödan, segt på surfplatta | Endast om dataset är strikt litet (t.ex. hårt datumintervall) och kan garanteras |
| “Generic report endpoint” med fria fält/ops | Max flexibilitet | Svår att säkra/validera, svår att indexera, presets bryts ofta | Nästan aldrig i v1; hellre whitelists per report |
| Preset = rå TanStack state utan schemaVersion | Spara snabbt | Bryts vid minsta kolumnändring, svårt att migrera | Endast som prototyp; inte om presets ska vara “riktiga” |
| Export byggs som `JSON→CSV` i minnet | Enkelt | OOM/timeouts vid större exports | Endast för små exports, annars streaming |
| Aggregering i appservern (hämta allt, groupa i JS) | Lätt att debugga | Extremt dyrt, fel vid pagination, långsamt | Endast för väldigt små dataset och som temporär jämförelse i test |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Spreadsheet-program (Excel/Sheets) | Tror att CSV är “passivt” textformat | Hantera CSV-injection, citera fält, testa med riktiga verktyg |
| Reverse proxy (Apache/Nginx) | Default timeouts/buffering dödar lång export | Säkerställ timeouts/buffering för streaming endpoints, eller begränsa exportstorlek |
| Auth (NextAuth/JWT) + filnedladdning | Export endpoint anropas utan rätt token/headers | Återanvänd `fetchWithAuth()`-mönster och testa download-flödet i browser |
| ConfigService (kategorier/bälten) | Filterlistor hårdkodas och blir stale | Läs dynamiskt från config och hantera config-ändringar (t.ex. invalid presets) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Saknade/olämpliga MongoDB-index för vanliga filter/sort | P95 latens sticker, CPU spikes | Indexplan utifrån report contract; mät med explain/profiling | När historik växer (månader→år) |
| Sorting på beräknade/lookup:ade fält | Sort blir extremt dyr, tar disk | Begränsa sorterbara fält; precompute vid behov | Redan vid tusentals rader om pipeline blir tung |
| UI renderar för många rader utan virtualisering | Scroll hackar, iPad blir varm | Paginering + row-virtualization i rådata | 1k–10k+ DOM-rader |
| Export utan backpressure | RSS växer och processen dör | Stream/pipeline, respektera `drain` | Vid stora exports eller långsam klient |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| CSV-injection (formel-injektion) | Exfiltration/attack när CSV öppnas i Excel | Sanera celler, citera fält, testa med farliga prefix |
| Whitelist saknas för sort/filter | NoSQL-injection-liknande risk + DoS (dyr query) | Tillåt endast kända fält/ops och validera payload |
| Delade presets utan ägarskap/policy | Obehörig läs/skriv (IDOR) | Access-kontroller och audit, begränsa vad delade får ändra |
| Export endpoint kringgår RBAC | Massläckage av persondata | Samma auth-middleware + service-layer enforcement |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Oklart “vad är aktivt” (filter/sort/kolumner) | Användaren tror data är fel | Visa aktiva filterchips + “reset all” + tydlig sortindikator |
| Agg-läge utan drill-down | Misstro mot totals, svårt att verifiera | Låt agg-rader skapa motsvarande rådata-filter (drill-down) |
| För små touch-targets och popovers | Frustration på surfplatta | Större controls, förenkla filter UI, undvik tät tabell på iPad |
| Preset-ändringar som plötsligt påverkar andra | Team tappar förtroende | “Klona” delade presets till egen eller versionera/publicera |

## "Looks Done But Isn't" Checklist

- [ ] **Datumintervall:** Samma tidszon/normalisering i UI, API och export.
- [ ] **Export:** Exporterar *alla* filtrerade rader (inte bara current page) och exakt de aktiva kolumnerna.
- [ ] **Presets:** Har `schemaVersion` och valideras/migreras vid laddning.
- [ ] **Shared presets:** Har tydlig ägarskapspolicy (vem får skapa/ändra) och korrekt auth-kontroll.
- [ ] **Agg-läge:** Nyckeltalens definition är explicit och verifierbar (gärna via drill-down).
- [ ] **Global search:** Definierade fält + prestanda är testad, inte “regex över allt”.
- [ ] **Index:** Finns för de vanligaste filtren/sorteringarna och har verifierats med mätning.
- [ ] **CSV-säkerhet:** CSV-injection-mitigering är på plats och testad.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Otydlig semantik → fel siffror | HIGH | Frys rapportdefinition, skriv “contract”, backfill tester, kommunicera ändring, migrera presets |
| Tidszonsbuggar | MEDIUM/HIGH | Lägg canonical filterrepresentation, migrera UI, backfill regressiontester (DST/midnatt) |
| Presets bruten efter release | MEDIUM | Lägg schemaVersion+migrator, auto-fixa eller markera presets som “kräver uppdatering” |
| Export OOM/timeouts | MEDIUM/HIGH | Byt till streaming, inför gränser, ev. bakgrundsjobb senare |
| CSV-injection upptäcks | MEDIUM | Patcha sanitization, rotera/varna användare, lägg testfall och security checklist |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Otydlig rapportsemantik | Fas R1 | Nyckeltal har dokumenterad definition; drill-down ger samma totals |
| Tidszon/off-by-one | Fas R1 | Testfall för midnatt/DST; UI och export matchar |
| UI/backend mismatch | Fas R2 | Backend validerar och returnerar 400 för ogiltiga filter; export/tabell delar query-builder |
| Presets utan version/migration | Fas R3 | Presets har schemaVersion och migreras/valideras vid load |
| Export = current page | Fas R5 | Export innehåller hela filtrerade datasetet; jämförelse mot API-count |
| Export utan streaming/backpressure | Fas R5 | Export klarar stora mängder utan minnesökning; proxy-timeouts hanteras |
| CSV-injection | Fas R5 | Test med värden som börjar med `=,+,-,@` är säkra i Excel |
| Dyra aggregeringar | Fas R2 | Agg endpoints har acceptabel p95; index och `$match` tidigt verifierat |
| Shared presets IDOR/policy | Fas R3 | Access-test: kan inte läsa/ändra andras privata presets; delade följer policy |
| Global search dyr/vag | Fas R2 | Sökfält begränsade och mätta; inga full scans i normalfall |

## Sources

- https://owasp.org/www-community/attacks/CSV_Injection — CSV/Formula Injection och mitigations (inkl. Excel-beteenden).
- https://nodejs.org/api/stream.html — Node streams, backpressure och `pipeline()` (relevant för streaming-export).
- https://www.mongodb.com/docs/manual/core/aggregation-pipeline/ — MongoDB aggregation pipeline och begränsningar.

---
*Pitfalls research for: reporting UI + presets + CSV export (attendance domain)*
*Researched: 2026-04-13*
