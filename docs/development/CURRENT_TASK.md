# Current Task

> **Active package: `7D` — Sizing & candidate selection**
> This is the *only* active work package. Do not start 7E or anything later.
> When 7D is complete and merged, advance this file and `status.json` to 7E.

## Previously completed

- **Milestone 6 (6A–6H) — COMPLETE.**
- **7A** library store & browse · **7B** record & property editor ·
  **7C — Import/export & source adapters UI — DONE (2026-07-24).**
  `mergeIncomingLibrary` (imports merge, verified-overwrite refused) +
  `LibraryIoPanel` (JSON/CSV export/import, adapter compliance read-only). 413
  tests. See `DECISIONS.md` D-014.

## Objective (7D)

Turn a calculated **demand** into **ranked hardware candidates** from the
library, using the built-and-tested sizing engine
(`calculations/componentSizing.ts`). Show each candidate's demand, published
rating, derated rating, utilization, and the controlling criterion — honestly.

## In scope

1. A sizing UI: enter/select a demand (force, e.g. a cable tension or hook
   resultant — optionally seeded from a CUFTS analysis run) and a design factor,
   pick a component category, and run the sizing engine over the library
   records in that category.
2. Show every candidate ranked (by margin), each with: manufacturer/model/part,
   demand, published rating, derated rating, utilization, controlling criterion,
   verification state, and source. **Never auto-select the smallest passing
   part** — show all candidates and the assumptions.
3. Exclude obsolete/unverified candidates when verified data is required; a
   candidate with a **missing** rating is *insufficient information*, never
   "adequate".
4. Tests per `TEST_REQUIREMENTS.md` §7D.

## Out of scope

- BOM assembly / procurement sheet / RFQ (7E).
- Wiring the optimizer (M12) — sizing only.
- Deriving demands from custom-project analysis (custom analysis is deferred);
  demands may be entered manually or taken from a CUFTS run.

## Files to read (only these)

- `src/calculations/componentSizing.ts` — the sizing engine: required rating =
  demand × design factor, deratings, ranking, exclusions, missing→insufficient.
  (Read its exact input/output types before wiring — do not change it.)
- `src/core/library/componentLibrary.ts` — `selectRecords`, record ratings,
  `isRecordVerified`.
- `src/state/libraryStore.ts`, `src/core/projectRun.ts` (a run's scalars can
  seed a demand), `src/units/units.ts`.
- `src/components/LibraryBrowser.tsx` / a new sizing component; where to mount.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 413 + new 7D tests).
- Candidates are ranked without auto-picking the smallest passing part;
  obsolete/unverified excluded when verified data is required; a missing rating
  never reads as adequate.
- Each candidate shows demand, published & derated rating, utilization, and the
  controlling criterion.
- No engineering math in UI (Rules 2/7) — the sizing engine does the math; no
  `src/calculations/` changes; `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 7D DONE and 7E ACTIVE.
4. Single package-scoped commit.
