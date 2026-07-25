# Current Task

> **Active package: `6E` — Supports, constraints & loads**
> This is the *only* active work package. Do not start 6F or anything later.
> When 6E is complete and merged, advance this file and `status.json` to 6F.

## Previously completed

- **6A** — Project store & app shell.
- **6B** — Template gallery & new-project flow.
- **6C** — Canvas foundation (read-only 2D view).
- **6D — Node & element editing — DONE (2026-07-24).** Introduced an
  authoritative-geometry **custom** project (`core/templates/custom.ts`,
  `customNodeElement` now implemented) whose edits round-trip losslessly; pure
  `core/projectEdits.ts` (add/move/delete nodes & elements with integrity
  cascades); `adoptCustomProject` serialization path; canvas editing
  (Select/Add/Connect/Delete, drag-move, 1 m snap, live length readout). 365
  tests pass, browser-verified add/connect/delete/move persist across reload.
  See `DECISIONS.md` D-007.

## Objective (6E)

Extend editing on **custom** projects to boundary conditions and loading:
assign **supports** and **constraints** to nodes, and define **loads**, **load
cases**, and user **load combinations** — all committed immutably through the
store, keeping `checkProjectIntegrity` green.

## In scope

1. Assign/edit/remove a **support** on a selected node (kind: fixed / pinned /
   roller / spring / prescribed; restrained DOF mask; frame-tagged).
2. Assign/remove **constraints** referencing nodes (and a path element where
   relevant).
3. Define **loads** (point force, gravity, wind, pretension, brake, …) on a
   node or element, with frame-tagged components in the active unit system.
4. Group loads into **load cases**, and load cases into user **load
   combinations** — **no hard-coded building-code factors** (record a standard
   only if the user explicitly selects one).
5. Show these on the canvas and/or an inspector list; deletion cascades so
   integrity holds (reuse/extend `core/projectEdits.ts`).
6. Tests per `TEST_REQUIREMENTS.md` §6E.

## Out of scope

- Free-form dimensioned property editing of arbitrary quantities (6F —
  property inspector & provenance).
- Solver runs / result badges (6G); migration of v1 scenarios (6H).
- Editing supports/loads on CUFTS projects (they stay derived/read-only).

## Files to read (only these)

- `src/core/projectEdits.ts` — extend with support/constraint/load operations
  (keep them pure + immutable + integrity-preserving).
- `src/core/model.ts` — `Support`, `Constraint`, `Load`, `LoadCase`,
  `LoadCombination`, `checkProjectIntegrity`.
- `src/core/coordinates.ts` — frames / DOF; `src/core/provenance.ts` — `Quantity`.
- `src/components/EditorCanvas.tsx` / `FixtureEditor.tsx` — where to surface the
  new controls; `src/state/projectStore.ts` — `setProject` commit path.
- `src/units/units.ts` — unit display for load magnitudes.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 365 + new 6E tests).
- Supports/constraints/loads/cases/combinations persist on the custom Project
  and survive reload; every edit keeps `checkProjectIntegrity` clean.
- Load combinations are user-defined only — no assumed code factors; vectors
  state their coordinate frame.
- No engineering math in UI (Rules 2/7); no `src/calculations/` changes;
  `src/core/` changes additive and recorded.
- CUFTS + earlier packages unchanged.

## Definition of done

1. Code + tests within scope.
2. `npm test` and `npm run build` green.
3. Decisions recorded in `DECISIONS.md`.
4. `status.json` and this file advanced to mark 6E DONE and 6F ACTIVE.
5. Single package-scoped commit.
