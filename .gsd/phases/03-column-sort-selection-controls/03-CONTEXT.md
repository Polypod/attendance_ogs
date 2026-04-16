# Phase 3: Column, Sort & Selection Controls - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>

## Phase Boundary

Den här fasen levererar förbättrade kontrollmöjligheter för rapporttabellerna i **Raw** och **Aggregated** läge:

- Kolumn visa/dölj
- Sortering (klick på rubriker)
- Global fri-text-sök
- Förbättrade multi-val/urval

Uttryckligen **inte** i denna fas:

- Presets (Phase 4)
- CSV Export (Phase 5)

</domain>

<decisions>

## Implementation Decisions

### Sortering

- **D3-01:** Raw-läget: **alla kolumner** ska kunna sorteras.
- **D3-02:** Aggregated-läget: ska kunna sortera både på **gruppnamn** (group key) och på **metrics**.
- **D3-03:** Default-sort:
  - Raw: **senaste först**.
  - Aggregated: default = **mest närvaro först**, **förutom** när groupBy = `sessions` då default = **datumordning, senaste först**.
- **D3-04:** Textsort ska vara **case-insensitive**.
- **D3-05:** Tomma värden ska sorteras **sist**.
- **D3-06:** Byte av sort ska **inte** automatiskt hoppa tillbaka till sida 1.

### Kolumn visa/dölj

- **D3-07:** Raw default synliga kolumner är exakt:
  - `Date`, `Start`, `End`, `Student`, `Class`, `Instructor`, `Status`
- **D3-08:** Aggregated har kolumn-visa/dölj med **rimliga defaults**:
  - Grupp-kolumn(er) (t.ex. `Student` eller `Instructor` eller `Class`, och för `sessions`: datum/tid/klass enligt den tabellens grupp-representation)
  - `PresentCount`
  - `TotalCount`
- **D3-09:** Kolumnval ska vara **separata** per läge (Raw vs Aggregated).
- **D3-10:** Kolumnval behöver **inte** persisteras (återställs till default vid sidladdning) tills Presets i Phase 4.

</decisions>

<canonical_refs>

## Canonical References

- `.gsd/ROADMAP.md` — Phase 3 mål + success criteria
- `.gsd/STATE.md` — aktuell position
- `.gsd/PROJECT.md` — constraints och övergripande krav

</canonical_refs>

---

*Phase: 03-column-sort-selection-controls*
*Context gathered: 2026-04-14*
