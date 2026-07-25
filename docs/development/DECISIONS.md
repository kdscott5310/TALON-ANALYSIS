# Decisions Log

Short, append-only record of architectural decisions for the M6/M7 UI phase.
One entry per decision. Newest first. Record any non-obvious choice a package
makes so later sessions don't re-litigate it.

Format:

```
## D-NNN — <title>  (YYYY-MM-DD, package)
**Decision.** …
**Why.** …
**Consequences / alternatives rejected.** …
```

---

## D-007 — 6D adds an authoritative-geometry "custom" project type  (2026-07-24, 6D)

**Decision.** Rather than editing CUFTS geometry (which is projected from its
scenario and re-derived on load — edits would be discarded), 6D introduces a
**custom** project whose nodes/elements ARE the model. Editing is gated to
custom projects; CUFTS stays read-only/derived. (User-selected option, over
edit-back-to-scenario.)

**Implementation.**
- `core/templates/registry.ts`: `customNodeElement` promoted `planned → implemented`
  (milestone M6); its builder ignores the scenario arg.
- `core/templates/custom.ts` (new): `createCustomProject` (global frame + two
  starter nodes, provisional/uncertified) + `isCustomProject`; registers the
  builder. Reachable from the 6B gallery as "Available".
- `core/projectEdits.ts` (new): pure immutable `addNode`/`moveNode`/`deleteNode`/
  `addElement`/`deleteElement`; `deleteNode` cascades to dependent elements,
  supports, constraints, loads, and moving bodies so integrity holds.
- `core/projectSerialization.ts`: `adoptCustomProject` adopts custom geometry
  **as-is** (defaults optional collections, enforces `checkProjectIntegrity`) —
  no re-derivation, so edits round-trip losslessly.
- `EditorCanvas.tsx`: Select/Add/Connect/Delete modes, node drag-move, 1 m grid
  snapping, and a live length readout in the active unit system; edits commit
  through `setProject`.

**Why core edits were justified.** The chosen approach *requires* a
non-re-deriving serialization path; without it edits can't persist (Rule 10).
Change is additive and does not touch CUFTS behavior — verified by the
unchanged generalizedModel/platformCore CUFTS regression tests.

**Consequences.** Two existing template-catalogue tests updated to expect
`['cufts','customNodeElement']` implemented. Editing creates cables only for
now; other two-node element types and supports/loads editing are 6E+. Browser-
verified add/connect/delete/move persist across reload.

## D-006 — 6C canvas splits a pure mapping from an interactive SVG  (2026-07-24, 6C)

**Decision.** The 2D editor is two parts: `src/visualizations/editorScene.ts`
(pure `buildEditorScene(project)` → world-space nodes/edges/attachments/frames/
bounds) and `src/components/EditorCanvas.tsx` (SVG rendering, pan/zoom/grid,
selection). The plane is the global **x–z elevation** (x downrange horizontal,
z up vertical); global y is dropped (CUFTS is planar until M11). SVG draws z as
`-z` so up is up. World→screen uses a `viewBox`; marks are sized proportionally
to `viewBox.w` so they stay legible at any zoom.

**Why.** Rule 2/7: all model→geometry logic lives in the pure, unit-tested
module (`editorScene.test.ts` traces every output to node positions / element
node refs / frames); the component adds no engineering or geometry math beyond
screen mapping. Mirrors the existing `visualizations/sceneData.ts` boundary.

**Consequences.** 6C is read-only — selection is visual state only, no mutation.
Future (export-only) element types are flagged `future` and drawn dashed
(Rule 11). 6D adds editing on top of the same store + mapping. Added
`.editor-canvas`/`.editor-toolbar` styles.

## D-005 — 6B creates projects through the registry gate  (2026-07-24, 6B)

**Decision.** New-project creation goes through `instantiateTemplate` (via a thin
`newProjectFromTemplate` helper + a `createFromTemplate` store action). The
`TemplateGallery` component renders every `FIXTURE_TEMPLATES` entry but enables
only `status: 'implemented'` templates; planned templates render disabled with a
lock badge and their delivering milestone.

**Why.** The registry already refuses planned templates by throwing (Rule 8/11).
Routing the UI through it — rather than hard-coding "CUFTS only" — means the
gallery stays honest automatically as templates graduate, and the throw path is
covered by tests instead of being bypassed. The example scenario seeds CUFTS;
`instantiateTemplate` never reaches a builder for a planned id.

**Consequences.** Creating a project replaces the active one (consistent with
6A's reset). Added `.template-gallery`/`.template-card` styles and `.badge-ok`/
`.badge-locked`. A failed create (planned id) throws without corrupting store
state — asserted in `src/tests/templateGallery.test.ts`.

## D-004 — 6A persistence reuses the validated serialization path  (2026-07-24, 6A)

**Decision.** The project store (`src/state/projectStore.ts`) persists by writing
`exportProjectJson(project)` and loads by running `importProjectJson(raw)` —
the same tested path used for file import. Storage uses a dedicated key
`talon-project-v1`. A read-only "Fixture Editor" tab was added by extending the
v1 store's `WorkflowTab` union with `'editor'` (navigation only).

**Why.** Routing load through `importProjectJson` means corrupt or hand-edited
saved data is re-validated and re-derived from the CUFTS scenario on every load,
so recovery is honest (visible notice, never a silent default — Rule 10) and
missing quantities stay `null` (Rule 4). Reusing the serializer avoids a second,
divergent persistence format.

**Consequences.** Reloading a freshly seeded project re-derives it
deterministically (ids/timestamps preserved), so the round-trip is lossless and
`toEqual`-stable — asserted in `src/tests/projectStore.test.ts`. The store
exposes only an immutable `setProject`, `resetToExampleProject`, and
`toProjectJson`; graphical editing is deferred to 6C+.

## D-003 — Split M6/M7 into lettered work packages  (2026-07-24, docs)

**Decision.** M6 (generalized platform + graphical fixture editor) is divided
into `6A–6H`; M7 (component library + procurement) into `7A–7E`. Each package is
one focused, independently reviewable session.

**Why.** The engineering cores are large and already built; the remaining work
is UI/integration that benefits from small, testable increments and low
per-session context. Lettered packages keep exactly one thing active.

**Consequences.** `status.json` tracks a single ACTIVE pointer; agents load only
the files a package needs (`FILE_MAP.md`). Note: these M6/M7 letters denote the
*UI-adoption* phase and are distinct from the original numeric milestones M6–M17
whose solver cores already landed in `main`.

## D-002 — Parallel Project store, not a rewrite of the v1 store  (2026-07-24, 6A design)

**Decision.** 6A adds a new `projectStore` beside the existing v1 `store.ts`
rather than migrating the v1 UI onto the `Project` model in place. Persistence
uses a new localStorage key.

**Why.** The v1 CUFTS UI and its Level-1 results are validated and must keep
working unchanged (Rule 1). A parallel store lets the editor grow on the
`Project` model while the v1 tabs stay untouched; migration of v1 scenarios into
Projects is deferred to 6H.

**Consequences.** Two stores coexist during the transition; a later package may
converge them once the editor reaches parity. Rejected: big-bang replacement
(risks the locked regression) and runtime Scenario↔Project shims in the v1 tabs
(unnecessary coupling).

## D-001 — Reuse existing engines; UI adds no engineering math  (2026-07-24, phase)

**Decision.** The M6/M7 UI phase consumes the already-built solvers and core
modules through their existing contracts (`core/solver.ts`,
`core/projectAnalysis.ts`, `calculations/*`, `core/library/*`,
`reports/procurementSheet.ts`). No new solvers, fidelity levels, or calculation
logic in UI/store/rendering code.

**Why.** Rules 2 and 7: engineering math stays out of React and out of
rendering. The engines are tested; duplicating logic in the UI would risk
divergence and erode the validated boundary.

**Consequences.** UI packages are presentation + orchestration only. Any gap
found in an engine is raised as its own change, not patched inside a component.
Rejected: convenience calculations in components (violates the architecture
tests and safety rules).
