# Attendance OGS

## What This Is

Attendance OGS är ett närvarosystem för en karateklubb/skola: hantera elever, klasser och pass, samt registrera och redigera närvaro. Nästa fokus är en ny rapportsida i dashboarden som gör det enkelt att ta ut sammanställningar och exportera data.

## Core Value

Admin och instruktörer kan snabbt få fram korrekt närvarodata (rådata eller summeringar), återanvända sparade vyer och exportera resultatet.

## Requirements

### Validated

- ✓ Autentisering + rollbaserad åtkomst (RBAC) — befintligt
- ✓ Elevhantering med kategorier och bältesnivåer — befintligt
- ✓ Klass-/passhantering och kalender — befintligt
- ✓ Närvaroregistrering per pass och elev, inkl. historikredigering — befintligt
- ✓ Dashboard för dagens pass — befintligt

- ✓ **Rapportsida (rådata)** för admin + instruktör — tabell (en rad per närvaro-registrering) med filter och paginering (Phase 1)

### Active

- [ ] **Rapportsida (aggregerat läge)**: summeringar med standard-grupperingar (per student, per instruktör, per pass/session, per klass) och nyckeltal
- [ ] **Kolumnhantering**: kunna visa/dölja valfria fält i tabellen
- [ ] **Sortering + filtrering per fält** (inkl. datumintervall där relevant) samt **global fri-text-sök**
- [ ] **Presets**: spara och återanvänd tabellinställningar server-side per användare, samt stöd för **delade presets**
  - Preset ska omfatta: vy-läge (rå/agg), valda kolumner, sortering, filter, gruppering och nyckeltal
- [ ] **CSV-export** av “synliga värden”: exportera hela filtrerade resultatet med de kolumner som är aktiva i vyn

### Out of Scope

- Diagram/BI-dashboard (t.ex. grafer, pivot-byggare) — inte kärnkrav för första leveransen
- PDF/Excel-export — CSV räcker initialt
- Avancerad behörighetsmodell per instruktör (”bara egna pass”) — initialt ser instruktörer all data

## Context

- Monorepo: Express + Mongoose backend (`src/`) och Next.js App Router frontend (`frontend/src/`).
- Domänkonfig (kategorier, bältesnivåer) är YAML-driven via `config/system.yaml` och `ConfigService`.
- Närvarodata är kopplad till elev + pass (class schedule) + datum + status, och ska kunna sammanställas i flera dimensioner.
- Rapportsidan ska vara “teacher-friendly” och fungera bra även på surfplatta.

## Constraints

- **Tech stack**: Behåll befintlig stack (Next.js/React + shadcn/ui/Tailwind i frontend; Express/Mongoose i backend) — minimera nya beroenden.
- **Security/Access**: Rapporter är endast för admin + instruktör — varför: innehåller persondata och intern verksamhetsdata.
- **Scalability**: CSV-export av hela filtrerade resultatet ska fungera även vid större datamängder — kan kräva server-side export/streaming.
- **Presets**: Presets måste kunna sparas per användare och kunna markeras som delade/globalt återanvändbara.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Två rapportlägen (rådata + aggregerat) | Behöver både detaljgranskning och snabba sammanställningar | — Pending |
| Admin + instruktör får åtkomst | Primära användare för uppföljning | — Pending |
| Instruktörer ser all data initialt | Enklare regelverk, snabbare leverans | — Pending |
| Presets sparas i DB per användare + delade presets | Återanvändning mellan enheter + teamstandard | — Pending |
| CSV exporterar hela filtrerade resultatet med aktiva kolumner | Matchar ”synliga värden” och reell exportnytta | — Pending |
| Global fri-text-sök utöver fältfilter | Snabb navigering för namn/klass | — Pending |
| Standard-grupperingar: student, instruktör, pass, klass | Täcker vanligaste rapportdimensioner | — Pending |
| Nyckeltal i v1: antal närvarande + total antal registreringar | Minsta men nyttiga summeringar | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after Phase 1 completion*
