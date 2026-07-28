# Current Task

> **Active package: `6H` — Serialization, migration & regression (closes M6)**
> This is the *only* active work package. When 6H is complete and merged,
> M6 is done; advance `status.json` and start M7 at 7A.

## Previously completed (M6 so far)

- **6A** store · **6B** template gallery · **6C** canvas · **6D** node/element
  editing (custom projects) · **6E** supports/constraints/loads · **6F**
  property inspector & provenance ·
- **6G — Analysis-run wiring & fidelity badges — DONE (2026-07-24).**
  `core/projectRun.ts` maps the validated v1 summary into the solver-result
  contract as a frozen, reproducible `AnalysisRun`; `AnalysisPanel` shows the
  honest badge (Level 1, Not certified, missing≠OK). Custom-project analysis is
  deferred — an explicit no-solver result, no fabrication. 386 tests. See
  `DECISIONS.md` D-010.

## Objective (6H)

Make Project persistence and the CUFTS↔Project relationship **durable and
provably correct**, closing M6:

1. **Project JSON export/import UI** in the Fixture Editor — download the active
   project as a `talon-project` file and import one back (custom projects
   round-trip losslessly; malformed files are rejected with a visible reason,
   not silently accepted).
2. **Migrate v1 scenarios into Projects** — a path to bring an existing v1
   `Scenario` (from the v1 scenario library / a scenario JSON) into a CUFTS
   Project via `projectFromScenario` / `importProjectJson`, with disclosed
   migration notes and no data loss.
3. **End-to-end regression** — assert that CUFTS static/dynamic/summary results
   obtained **through the Project path** equal the v1 results **exactly**
   (bit-for-bit), so the generalized platform never changed a validated number.

## In scope

- Export/import controls wired to `core/projectSerialization.ts`
  (`exportProjectJson`/`importProjectJson`) and the project store.
- A "convert v1 scenario → project" action (from the active v1 scenario or an
  imported scenario file) using `projectFromScenario`.
- Tests: round-trip (custom + CUFTS), migration-notes disclosure, and the
  exact-equality CUFTS regression through the Project path.

## Out of scope

- New solvers / custom-project analysis (deferred).
- M7 component-library work (starts at 7A).

## Files to read (only these)

- `src/core/projectSerialization.ts` — `exportProjectJson`, `importProjectJson`,
  `projectFromScenario`.
- `src/core/templates/cufts.ts` — `extractScenario`, `buildCuftsProject`.
- `src/core/projectAnalysis.ts` — CUFTS results via the Project path.
- `src/calculations/staticAnalysis.ts` / `dynamicsAnalysis.ts` /
  `statusSummary.ts` — the v1 results to compare against (read-only).
- `src/state/projectStore.ts` (`setProject`, `toProjectJson`), `src/state/store.ts`
  (the v1 scenario library), `src/components/FixtureEditor.tsx`.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 386 + new 6H tests).
- Project JSON round-trips losslessly; malformed import rejected with a notice.
- A v1 scenario migrates into a Project with disclosed notes, no data loss.
- **Exact-equality regression**: CUFTS static/dynamic/summary via the Project
  path equal the v1 result (bit-for-bit) — the M6 headline guarantee.
- No `src/calculations/` changes; `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 6H DONE and **M6 complete**;
   set active package to 7A (M7).
4. Single package-scoped commit.
