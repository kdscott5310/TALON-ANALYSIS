# Current Task

> **Active package: `6D` — Node & element editing**
> This is the *only* active work package. Do not start 6E or anything later.
> When 6D is complete and merged, advance this file and `status.json` to 6E.

## Previously completed

- **6A — Project store & app shell — DONE.**
- **6B — Template gallery & new-project flow — DONE.**
- **6C — Canvas foundation — DONE (2026-07-24).**
  `src/visualizations/editorScene.ts` (pure `buildEditorScene` →
  nodes/edges/attachments/frames/bounds) + `src/components/EditorCanvas.tsx`
  (SVG pan/zoom/grid, coordinate-frame markers, read-only selection). 356 tests
  pass, build clean, browser-verified (5 nodes / 3 elements / 3 attachments,
  node+element selection, zoom/pan, no console errors). See `DECISIONS.md`
  D-006.

## Objective (6D)

Make the canvas **editable**: add / move / delete nodes, and create / delete
two-node elements, committing every change immutably through the project store.
Add grid/endpoint snapping and a live dimension readout, with lengths shown in
the active unit system.

## ⚠️ Key design tension — resolve this first

Only the **CUFTS** template is implemented, and its geometry is **projected from
the authoritative `templateData.cufts` scenario** by `buildCuftsProject`. On
reload, `adoptProject` **re-derives** nodes/elements from that scenario, so
**raw node/element edits on a CUFTS project will not round-trip** — they are
overwritten. Decide and record (in `DECISIONS.md`) one of:

1. **Edit-back-to-scenario** for CUFTS (map canvas edits to scenario fields;
   only the fields the scenario exposes are editable), or
2. **Editable custom projects only** — introduce a non-CUFTS "custom" project
   whose nodes/elements are authoritative (no scenario re-derivation), and gate
   free editing to those; CUFTS geometry stays read-only/derived.

Option 2 is the cleaner long-term seam (it also unblocks the planned
`customNodeElement` template) but is more work; option 1 keeps everything CUFTS.
Pick deliberately — do not silently let edits be discarded on reload (Rule 10).

## In scope

1. Canvas interactions to add a node, drag a node to move it, and delete a
   selected node/element.
2. Create a two-node element between two selected nodes; delete an element.
3. Grid + endpoint snapping; live dimension readout (segment length, node
   coordinates) in the active unit system via `units/units.ts`.
4. All mutations go through an immutable store update; the resulting `Project`
   passes `checkProjectIntegrity` (no dangling references).
5. Tests per `TEST_REQUIREMENTS.md` §6D.

## Out of scope

- Supports / constraints / loads editing (6E), property inspector (6F).
- Solver runs / result overlays / badges (6G), migration (6H).
- Editing single-node element internals beyond placement.

## Files to read (only these)

- `src/visualizations/editorScene.ts`, `src/components/EditorCanvas.tsx` — the
  6C canvas + mapping to extend.
- `src/state/projectStore.ts` — `setProject` (immutable commit path).
- `src/core/model.ts` — `Project`, `checkProjectIntegrity`.
- `src/core/coordinates.ts`, `src/core/elements.ts` — node/element shapes.
- `src/core/templates/cufts.ts`, `src/core/projectSerialization.ts` — to
  understand the CUFTS re-derivation tension above.
- `src/units/units.ts` — unit conversion for the dimension readout.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 356 + new 6D tests).
- Add/move/delete of nodes and create/delete of elements yield a `Project` that
  passes `checkProjectIntegrity`; edits are immutable (prior reference
  unchanged).
- Edits **persist across reload** per the chosen resolution above (not silently
  discarded).
- Dimensions display via `units/units.ts` (no ad-hoc math in components).
- v1 tabs and 6A–6C behavior unchanged; no `src/calculations/` changes;
  `src/core/` changes only if strictly required and recorded.

## Definition of done

1. Design tension resolved and recorded in `DECISIONS.md`.
2. Code + tests implemented within scope.
3. `npm test` and `npm run build` green.
4. `status.json` and this file advanced to mark 6D DONE and 6E ACTIVE.
5. Change committed as a single package-scoped commit.
