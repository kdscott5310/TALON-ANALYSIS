# Current Task

> **Active package: `6G` — Analysis-run wiring & fidelity badges**
> This is the *only* active work package. Do not start 6H or anything later.
> When 6G is complete and merged, advance this file and `status.json` to 6H.

## Previously completed

- **6A** store · **6B** template gallery · **6C** canvas · **6D** node/element
  editing (custom projects) · **6E** supports/constraints/loads ·
- **6F — Property inspector & provenance — DONE (2026-07-24).** Pure property
  ops (`setElementProperty`/`setMaterialProperty`/`addMaterial`/
  `setElementMaterial` + `updatedQuantity` preserving source value, Rule 5);
  dimension-aware display in `units.ts`; `ElementInspector`/`PropertyRow` UI with
  honest missing/unverified badges. 382 tests; browser-verified (0.5 ft →
  0.1524 m, missing stays absent, persists). See `DECISIONS.md` D-009.

## Objective (6G)

Run solvers **from the editor through the solver contract**, produce **frozen,
reproducible analysis runs**, and render honest **result badges**: fidelity
level, solver id + version, applicability, convergence, and certification status
(always “Not certified”).

## ⚠️ Decide the solver-per-project mapping first (record in DECISIONS)

- **CUFTS projects** already have validated Level-1 results via the v1 solvers.
  Surface them through `core/projectAnalysis.ts` + the run/badge contract —
  **do not recompute or change any CUFTS number** (Rule 1; exact-equality still
  holds).
- **Custom projects** carry general nodes/elements/supports/loads. The natural
  fit is the 2D truss direct-stiffness solver (`calculations/trussFEM.ts`,
  Level-2 groundwork) — but it needs real E·A per element and restraint/loads.
  Where those are **missing**, the run must report *insufficient information /
  not applicable*, never a fabricated result (Rules 2, 4; applicability engine
  in `core/solver.ts`).
- Do not invent a solver for geometry it cannot handle; if nothing applies, say
  so on the badge.

## In scope

1. A “Run analysis” action in the editor that builds an `AnalysisCase`, invokes
   the applicable solver via the contract, and stores a **frozen**
   `AnalysisRun` (`core/analysisRun.ts`) on the project.
2. Result panel rendering the **badge**: fidelity (0–3), solver id/version,
   applicability (within/outside limits / insufficient info), convergence, and
   certification status.
3. Reproducibility: same inputs → identical run (fingerprint stable).
4. Failed / non-convergent / insufficient cases render as such — not “OK”.
5. Tests per `TEST_REQUIREMENTS.md` §6G.

## Out of scope

- New solvers or new fidelity levels (engines already exist).
- Migration of v1 scenarios into Projects (6H).
- Report export (reporting milestone), optimization/uncertainty UI (M12 UI).

## Files to read (only these)

- `src/core/solver.ts` — solver contract: fidelity, applicability, acceptance,
  certification badge.
- `src/core/analysisRun.ts` — frozen, fingerprinted runs.
- `src/core/projectAnalysis.ts` — how CUFTS runs are orchestrated today.
- `src/calculations/trussFEM.ts` — the general solver for custom projects.
- `src/core/templates/cufts.ts` (`extractScenario`, `isCuftsProject`),
  `src/core/templates/custom.ts` (`isCustomProject`).
- `src/state/projectStore.ts`, `src/components/FixtureEditor.tsx` /
  `EditorCanvas.tsx` — where to surface the run + badge.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 382 + new 6G tests).
- Runs carry complete metadata (solver id/version, fidelity, applicability,
  convergence, certification) and are frozen/reproducible.
- No Level claim exceeds what was computed; missing-data/failed/non-convergent
  cases never render as OK.
- **CUFTS results unchanged** (regression stays exact); no `src/calculations/`
  edits; `src/core/` changes additive and recorded.

## Definition of done

1. Solver-per-project mapping recorded in `DECISIONS.md`.
2. Code + tests within scope; `npm test` and `npm run build` green.
3. `status.json` and this file advanced to mark 6G DONE and 6H ACTIVE.
4. Single package-scoped commit.
