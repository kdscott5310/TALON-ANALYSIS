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

## D-012 — 7A library store mirrors the project-store persistence pattern  (2026-07-24, 7A)

**Decision.** `state/libraryStore.ts` is a Zustand store over `core/library`,
mounted beside the project and v1 stores under its own key `talon-library-v1`.
It seeds the EXAMPLE-ONLY library on first run and persists via the validated
`libraryIo` path (`exportLibraryJson`/`importLibraryJson`), so corrupt saved
data is re-validated on load and dropped with a visible notice — same recovery
pattern as `projectStore` (D-002). `LibraryBrowser` is a new "Component Library"
tab: category filter, per-record verification badge (`recordVerificationState` +
`STATE_LABEL`), provenance summary, and the `auditLibrary` warnings.

**Honesty.** Seeds render "EXAMPLE ONLY / NOT FOR DESIGN" and are never shown as
verified (`isRecordVerified` false); the audit flags each as critical. Browse
is read-only; record/property editing is 7B, import/export + adapters 7C.

**Consequences.** No `src/core/` or `src/calculations/` changes — the store and
UI consume existing library modules. Browser-verified: 6 example-only records,
6 NOT-FOR-DESIGN badges, 6 critical warnings, working category filter, no
console errors. `libraryStore.test.ts` covers seed/persist/recover, the
seeds-never-verified guarantee, the audit, and category filtering.

## D-011 — 6H closes M6: project file I/O, v1 migration, exact-equality regression  (2026-07-24, 6H)

**Decision.** 6H adds project JSON export/import and v1-scenario migration in the
editor (`ProjectFilePanel`), all through the validated `projectSerialization`
path (`exportProjectJson`/`importProjectJson`/`projectFromScenario`) — no new
core logic. `applyImportedProject` on the store adopts an imported/migrated
project and surfaces its migration notes; malformed imports are rejected with a
visible reason, never silently accepted (Rule 10).

**Regression comparison note.** The v1 dynamics result caches derived
interpolation FUNCTIONS on `path` (distinct closures per call), so a raw
`toEqual` on two dynamics results fails by reference despite identical numbers.
The regression therefore compares the **serializable** projection
(`JSON.parse(JSON.stringify(...))`) for dynamics — the numbers that drive
results, reports, and persistence — asserting bit-for-bit equality. Static and
summary compare directly (no functions).

**Headline guarantee proven.** `projectRegression.test.ts` takes the CUFTS
scenario scenario → project → exported JSON → imported project → solved via the
adapters, and asserts static (every swept position), dynamics, and the status
summary equal the v1 solvers exactly — the generalized platform never changed a
validated number (Rule 1 / release gate 17). **M6 is complete.**

**Consequences.** No `src/calculations/` changes; the only store change is the
additive `applyImportedProject`. Browser-verified: migrate v1 → cufts project,
export downloads JSON, valid import succeeds, malformed import shows a visible
error. Next phase: M7 (component library + procurement) starting at 7A.

## D-010 — 6G runs CUFTS through the badge contract; custom analysis deferred  (2026-07-24, 6G)

**Decision (user-directed).** 6G wires analysis for **CUFTS projects only**:
`core/projectRun.ts` maps the validated v1 five-category summary
(`summarizeProject`) into the solver-result contract (`core/solver.ts`) and
freezes it as an `AnalysisRun`. **Custom-project analysis is deferred** to a
later package — `runProjectAnalysis` returns an explicit `{ ok: false, reason }`
("no solver ships for this template") rather than fabricating a result (Rule 4).
The truss-solver-for-custom path (`trussFEM.ts`) is intentionally NOT wired yet.

**Honesty of the mapping.** Fidelity is Level 1 (never higher than computed);
certification is always "Not certified"; a not-evaluated check becomes a
`missing` quantity (value null), never 0; a `failed`/`insufficient`/`error`
summary maps to `notAcceptable`/`insufficientInformation`, never OK. The run is
fingerprinted and reproducible (same inputs + ranOn → identical run).

**Runs held in view state (6G scope).** The run is shown in the editor's
`AnalysisPanel` and NOT persisted onto the project. CUFTS projects re-derive
their `analysisRuns: []` on load (D-007), so persisting run history there is a
separate concern; 6G delivers the frozen run + badge, and durable run history is
left for a later package. No engineering math added to UI or `projectRun`
(Rules 2/7) — it assembles metadata around an existing result.

**Consequences.** No new solvers; `src/calculations/` untouched; CUFTS numbers
unchanged. Browser-verified: CUFTS → Level 1 / Not certified / honest
NOT-ACCEPTABLE+insufficient badge, run integrity ok; custom → deferred message.
`projectRun.test.ts` covers fidelity, reproducibility, missing≠0, and the
custom no-solver path.

## D-009 — 6F edits dimensioned properties with source-value-preserving updates  (2026-07-24, 6F)

**Decision.** Element/material `Quantity` properties are edited through pure ops
in `core/projectEdits.ts` (`setElementProperty`, `setMaterialProperty`,
`addMaterial`, `setElementMaterial`) plus a `updatedQuantity(existing, valueSI,
state, dimension)` builder that changes only the working value and verification
state and **preserves the original `sourceValue` and derating provenance**
(Rule 5). A missing value is stored as `value: null` + state `missing`, never 0
(Rules 3/4). The `PropertyRow` UI shows a "missing"/"unverified" badge honestly
(`isMissing`/`isVerified`).

**Units.** Dimension-aware display lives at the conversion boundary
(`units.ts`): `toDisplayValue`/`fromDisplayValue`/`displayUnitLabel` map SI↔the
active system for the dimensions the editor exposes (length, force,
linearDensity, mass, area, velocity, energy); other dimensions fall back to SI;
dimensionless shows no unit. No conversion logic leaks into components.

**Consequences.** Editing is on custom-project cables (the only element type
custom projects create); material create/attach/edit included. Force/etc. entry
converts to SI on commit. Browser-verified: diameter 0.5 ft → 0.1524 m
(userVerified), untouched MBS stays absent (never 0), material density set — all
persist across reload with no console errors. `projectProperties.test.ts` covers
the ops, the source-value-preservation rule, missing handling, and unit
round-trips.

## D-008 — 6E extends editing to BCs/loads via the same pure-ops pattern  (2026-07-24, 6E)

**Decision.** Supports, constraints, loads, load cases, and user load
combinations are edited through pure immutable operations in
`core/projectEdits.ts` (extending 6D), surfaced by a new `FixtureInspector`
component rendered inside the canvas for custom projects. Selection stays local
to `EditorCanvas`; the inspector receives it as a prop (no store-level selection
state) — the `Selection` type is exported from `EditorCanvas`.

**Integrity.** A shared `normalizeReferences` helper prunes load-case factors
that name a deleted load and combination terms that name a deleted load case;
`deleteNode`/`deleteElement`/`removeLoad`/`removeLoadCase` all run it, so
`checkProjectIntegrity` stays clean under any deletion.

**Governance.** Load combinations are created with unit factors and **no
`standard`** — no building-code combination is ever assumed (M12 rule).
Force inputs are unit-converted (lbf↔N) only; no engineering math in the UI.

**Consequences.** Editing remains gated to custom projects (CUFTS read-only).
Canvas gains support-triangle and load-arrow glyphs. Browser-verified:
set-support, add-load (500 lbf → 2224 N), create case + combination all persist
across reload with no console errors. `projectSupportsLoads.test.ts` covers the
ops, cascades, and the serialization round-trip.

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
