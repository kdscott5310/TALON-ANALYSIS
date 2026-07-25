# Current Task

> **Active package: `6C` — Canvas foundation**
> This is the *only* active work package. Do not start 6D or anything later.
> When 6C is complete and merged, advance this file and `status.json` to 6D.

## Previously completed

- **6A — Project store & app shell — DONE.** `src/state/projectStore.ts` +
  read-only `src/components/FixtureEditor.tsx`, new "Fixture Editor" tab.
- **6B — Template gallery & new-project flow — DONE (2026-07-24).**
  `src/components/TemplateGallery.tsx` lists `FIXTURE_TEMPLATES` with CUFTS
  creatable and the other 12 locked to their milestone; `createFromTemplate` /
  `newProjectFromTemplate` route creation through the registry gate. 349 tests
  pass, build clean, browser-verified (1 enabled + 12 locked, no console
  errors). See `DECISIONS.md` D-005.

## Objective (6C)

A 2D editor **canvas that renders the active Project read-only**. Pan/zoom/grid,
an indicator of the active coordinate frame, and rendering of the Project's
nodes and elements at their true coordinates. Selection highlighting only — no
mutation yet.

## Why this next

6A/6B give us a Project in the store and a way to create one. 6C makes it
*visible* as geometry, establishing the canvas and the pure Project→drawables
mapping that node/element editing (6D) will build on.

## In scope

1. A canvas surface (SVG or Canvas) in the Fixture Editor tab that reads the
   active Project from the store.
2. A **pure mapping** function `project → drawable primitives` (nodes as points,
   elements as lines/segments between their nodes), unit-tested independently of
   rendering. Keep it separate from the React component (Rule 2/7).
3. Pan, zoom, and a reference grid; display the active coordinate frame
   (project has a global CS plus crane / trolley-path frames).
4. Selection highlighting of a node/element (visual only; no editing).

## Out of scope (do not build now)

- Any add/move/delete of nodes or elements (6D).
- Supports/constraints/loads editing (6E), property inspector (6F).
- Solver runs / result overlays / badges (6G).
- 3D — the existing `visual3d` tab already covers 3D; 6C is the 2D editor plane.

## Files to read (only these)

- `src/state/projectStore.ts` — active project source.
- `src/core/model.ts` — `Project`, `ModelNode`, element references.
- `src/core/coordinates.ts` — coordinate frames, `vec3`, node positions.
- `src/core/elements.ts` — element types and their `nodeIds`.
- `src/visualizations/sceneData.ts` — reference for a pure solver/model→geometry
  mapping (do not duplicate its math; mirror the *pattern*).
- `src/components/FixtureEditor.tsx` — where to mount the canvas.

## Acceptance criteria

- `npm run build` and `npm test` both pass (≥ 349 + new 6C tests).
- Nodes/elements render at correct coordinates in the stated frame; pan/zoom
  are stable.
- The model→drawables mapping is pure and unit-tested (no React in the tested
  unit); the canvas component contains no engineering/calculation logic
  (Rule 2/7).
- Existing v1 tabs and 6A/6B behavior unchanged.
- No changes under `src/calculations/`; `src/core/` unchanged unless strictly
  required (record in `DECISIONS.md`).

## Definition of done

1. Code + tests implemented within scope.
2. `npm test` and `npm run build` green.
3. Decisions recorded in `DECISIONS.md`.
4. `status.json` and this file advanced to mark 6C DONE and 6D ACTIVE.
5. Change committed as a single package-scoped commit.
