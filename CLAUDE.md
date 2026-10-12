# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript Express.js backend for a karate school attendance management system. It uses MongoDB with Mongoose ODM and provides a REST API for managing students, classes, schedules, and attendance tracking.

## Development Commands

### Core Development

- `pnpm run dev` - Start development server with hot reload using ts-node-dev
- `pnpm run build` - Compile TypeScript to JavaScript in dist/ directory  
- `pnpm start` - Start production server from compiled dist/index.js
- `pnpm test` - Run Jest test suite with coverage reporting

### Database

- `docker compose up -d` - Start MongoDB container on port 27019
- MongoDB connection: localhost:27019 with credentials in docker-compose.yml

## Architecture

### Core Structure

- **Models** (`src/models/`): Mongoose schemas with validation and indexing
- **Services** (`src/services/`): Business logic layer (e.g., AttendanceService for complex attendance operations)  
- **Controllers** (`src/controllers/`): HTTP request handlers that use services
- **Routes** (`src/routes/`): Express route definitions
- **Types** (`src/types/interfaces.ts`): TypeScript interfaces and enums for type safety

### Key Design Patterns

- **Multiple Categories**: Students and classes support multiple categories (kids, youth, adult, advanced)
- **Category-specific Attendance**: Attendance tracked per category for mixed-level classes
- **Separated Schedules**: Classes and ClassSchedules are separate entities for flexible scheduling
- **Time-based Logic**: Automatic next class detection using moment.js
- **Service Layer**: Complex business logic isolated in service classes

### Database Schema

- **Students**: Personal info, multiple categories, belt levels, emergency contacts
- **Classes**: Class definitions with categories, instructor, capacity
- **ClassSchedules**: Specific class instances with dates/times, recurring support  
- **Attendance**: Individual records linking students to specific class schedules

### Type System

- Comprehensive TypeScript interfaces in `src/types/interfaces.ts`
- Enums for categories, statuses, days of week
- DTOs for API requests/responses
- Extended interfaces for populated MongoDB documents

## Testing

- Jest configuration in `jest.config.js` with 80% coverage threshold
- Test files in `src/__tests__/` directory
- Setup file at `src/test/setup.ts`
- In-memory MongoDB for testing using mongodb-memory-server

## Path Aliases

- `@/*` maps to `src/*` (configured in tsconfig.json)

## Key Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM with validation
- **joi**: Additional request validation
- **moment**: Date/time manipulation for class scheduling
- **helmet**: Security middleware
- **cors**: Cross-origin resource sharing

## GitNexus

Use GitNexus tools for symbol/context/impact analysis before non-trivial edits and run change detection before committing.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **attendance_ogs** (2944 symbols, 6299 relationships, 241 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/attendance_ogs/context` | Codebase overview, check index freshness |
| `gitnexus://repo/attendance_ogs/clusters` | All functional areas |
| `gitnexus://repo/attendance_ogs/processes` | All execution flows |
| `gitnexus://repo/attendance_ogs/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
