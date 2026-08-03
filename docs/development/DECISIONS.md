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

## D-017 — Phase M8/M9: surface L2 engines + git-based sharing  (2026-07-24, planning)

**Decision (user-directed).** New phase after M6/M7: **M8** surfaces four tested
Level-2 engines with UI — brake curves, coupled dynamics, optimization, digital
twin (build order: brake curves first) — and **M9** adds design/standards
sharing. For sharing the user chose **git-based** over a cloud backend: the app
stays client-only/no-backend and reads/writes JSON files that engineers version
in a shared Git repo ("latest draft" = latest pull); standards sync first, then
project drafts. A real-time multi-user backend was explicitly deferred (hosting/
auth/cost/security review; I also cannot create accounts or enter credentials).

## D-023 — 8D digital twin: synthetic demo for pre-data use, labelled example-only (closes M8)  (2026-07-30, 8D)

**Decision.** `calculations/channelCsv.ts` (NEW, additive) imports measured
channels from CSV; `DigitalTwinPanel` ("Digital Twin" tab) conditions them
non-destructively, correlates predicted vs measured (RMSE, peak/timing/integral
error, R², overlay + residual plots), and runs parameter estimation with
identifiability reporting. The correlation engine `testCorrelation.ts` is NOT
modified.

**Built for "no data yet" (user constraint).** The user has no measured test data
yet, so the panel ships two paths: the real CSV import for when data arrives, and
a **built-in synthetic demo** so the workflow is exercisable now. The synthetic
channel is deterministic (seeded LCG — no `Math.random`, Rule 9), named
"…(EXAMPLE ONLY)", carries a persistent **"SYNTHETIC — EXAMPLE ONLY, NOT MEASURED
DATA"** badge, and its estimation results add "these parameters were fitted to
SYNTHETIC example data and mean nothing physically". A correlation against it can
never read as validating a design (Rule 4). The empty state documents the
expected CSV shape rather than leaving the user guessing.

**Raw preservation (Rule 5).** `channel.raw` and the original file text are kept
exactly as imported; conditioning (scale/polarity/zero) and filtering always
return NEW arrays. The panel displays raw-vs-conditioned first samples side by
side so the non-destructiveness is visible. A blank cell is a parse **error**,
never a silent 0 (Rules 3/4); non-monotonic time, missing header, and short files
are rejected with reasons; a sparse sample rate warns rather than being trusted.

**Consequences.** No existing solver or `src/core` modified. Browser-verified
end-to-end: empty state + format guidance; synthetic load shows the badge and 2
plots; the default model correlates poorly (R² −0.05, honest); estimation then
recovers the generator's true values — amplitude 0.99929 (1.0), decay 0.34974
(0.35), frequency 0.49972 (0.5) — RMSE 0.277→0.0084 (to the 3% noise floor), all
flagged identifiable. `channelCsv.test.ts` (11) pins parsing, blank-cell
rejection, raw preservation under conditioning+filtering, synthetic determinism
and labelling, near-perfect correlation of a matching model, known-parameter
recovery, and the UNIDENTIFIABLE flag for a parameter the data cannot constrain.
**M8 complete — all four requested analysis capabilities delivered.**

## D-022 — 8C optimization: additive objective adapter + disclosed feasibility tolerance  (2026-07-30, 8C)

**Decision.** `calculations/cuftsObjective.ts` (NEW, pure, additive) bridges the
tested optimizer to the validated v1 solvers: a design-variable vector is applied
to a *copy* of the scenario, the existing solvers run **unchanged**, and scalar
metrics are read back. Five variables (pretension, brake force, brake-zone
length, ballast blocks, design factor), five objectives, seven constraints.
`OptimizationPanel` ("Optimization" tab) drives it and shows the best design,
feasibility, controlling constraints, baseline→optimized metrics, local
sensitivity, and the full search history.

**The v1 guarantee.** Evaluating the BASELINE vector reproduces current v1
results exactly — `cuftsObjective.test.ts` asserts each metric equals a direct
solver run, and that `applyVariables(baseline)` deep-equals the scenario. So
optimization can never silently shift a signed-off number (Rule 1).

**Rejection, not scoring.** An invalid scenario (blocking validation errors) or a
thrown solver returns non-finite metrics, which the optimizer discards rather
than scoring (R-6). A trolley that never stops reports an **infinite** stroke,
never a flatteringly small one.

**Feasibility tolerance (a judgement call, disclosed).** The panel passes
`feasibilityTolerance = 1e-4` instead of the 1e-6 default. A penalty method
converges onto an ACTIVE constraint from the infeasible side by a vanishing
amount: browser verification produced a design flagged "INFEASIBLE — not a valid
design" over a **2.7e-6 m/s** excess on a ~20 m/s speed limit (relative ~1e-7),
i.e. line-search noise. Crying wolf at that scale trains engineers to ignore the
flag, which is itself a safety problem. The tolerance is small, is **disclosed in
the UI**, and a constraint satisfied only within it is labelled **"at limit
(active)"** — never "clear". A test pins both halves: noise-level excess is
feasible, a real (0.05) violation is not.

**Consequences.** No existing solver or `src/core` modified. Browser-verified:
the baseline example is genuinely INFEASIBLE (ground clearance, anchor sliding,
utilization — consistent with its 6G "NOT ACCEPTABLE" badge); with those two
baseline design problems deselected the search is FEASIBLE and honestly shows
the trade-off — peak tension 2536→888 lbf, but ground clearance −6.3→−19.6 ft
and speed to its limit. `cuftsObjective.test.ts` (13) covers baseline fidelity,
determinism, non-mutation, variable mapping, integer rounding, failure
rejection, tolerance behaviour, and end-to-end optimization over the real solvers.

## D-021 — 8B coupled dynamics: blank inputs are *not entered*, never 0  (2026-07-30, 8B)

**Decision.** `CoupledDynamicsPanel` (new "Coupled Dynamics" tab) surfaces the
two tested Level-2 engines — `wheelDynamics` (effective mass m + I/r², rotational
energy, wheel speed) and `payloadPendulum` (pitch/sway, envelope, attachment
reaction, period, settling, ground clearance). All math stays in the engines
(Rules 2/7); the panel converts units and renders.

**Missing-data handling.** The data migrated CUFTS projects mark *missing*
(rolling radius, wheel mass/inertia, suspension length, damping ratio) is entered
here. A blank field parses to `null`, the section renders
**"insufficient information — enter: …"** naming each missing input, and the
solve button is disabled — a blank is never coerced to 0 (Rules 3/4). Optional
ground clearance stays `null` ("not evaluated") rather than 0, and an undamped
swing reports "does not settle" instead of a settling time.

**Pendulum drive.** The panel synthesises a braking pulse (constant deceleration
for a duration, then coast) as the trolley acceleration history, so the pendulum
is usable standalone. Feeding a real CUFTS run's acceleration history in, and
coupling the reaction back into the cable, remain out of scope (M11).

**Consequences.** No existing solver modified; no `src/core` change. Browser-
verified in SI against hand calcs: I = 4·0.5·8·0.15² = 0.36 kg·m², I/r² = 16 kg,
m_eff = 916 kg (+1.8%), ω = 80 rad/s, E = 1.2 kJ; pendulum period 4.01 s =
2π√(L/g) exactly, 41.2° peak pitch under a 4 m/s² brake pulse, settling 22 s; no
console errors. `coupledDynamicsUi.test.ts` (9) pins zero-inertia exact
reduction, the geometry formula, angular speed, loud failure on invalid input,
the analytic period, damped-vs-undamped settling, determinism, and
clearance-null-not-zero.

## D-020 — 9B named project drafts as snapshots (closes M9)  (2026-07-30, 9B)

**Decision.** `core/projectDrafts.ts` (new, pure) adds a draft library: named,
timestamped **snapshots** of a Project, with save/update/rename/duplicate/delete
and newest-first ordering so "the latest draft" is simply `[0]`. The project
store gains `drafts` + `activeDraftId` and the matching actions, persisted under
its own key `talon-project-drafts-v1` with corrupt-data recovery.
`ProjectDraftsPanel` (in the Fixture Editor, above the 6H file panel) lists
drafts and can load, rename, duplicate, export, or delete each one.

**Snapshot isolation.** Saving and loading deep-copy the project, so editing the
live project never mutates a saved draft and loading a draft never aliases it —
asserted in tests. Individually malformed stored drafts are DROPPED with a
disclosed note; an unreadable payload recovers to an empty library with a
visible notice (Rule 10).

**Sharing (Git).** Per D-017 the app stays client-only: a draft is exported as
`talon-project` JSON, committed/pushed to the shared repo, then pulled and
imported by a colleague. Git history is the version trail; TALON does not merge
two engineers' edits — conflicts resolve like code. Automatic Git operations
from the browser and a live multi-user backend remain out of scope.

**Consequences.** No `src/calculations` changes; core addition is additive.
Browser-verified: saved "Baseline v1", switched the live project to a Custom
project, saved a second draft, loaded the baseline back (restored exactly, with
a notice), and both drafts survived reload ordered newest-first.
`projectDrafts.test.ts` (10) covers the ops, ordering, snapshot isolation,
serialization + malformed handling, the export→import sharing path, persistence
recovery, and store wiring. **Milestone 9 complete.**

## D-019 — 9A standards as a shared, Git-versioned JSON document  (2026-07-24, 9A)

**Decision (user chose standards-first).** Pivoted from the analysis stream to
collaboration. A `core/standards.ts` document (design factors, allowable limits,
verification policy, load-combination templates + identity) is edited in a
`StandardsPanel` (new "Standards" tab) and exported/imported as a versioned JSON
envelope (`core/standardsIo.ts`). Sharing is **git-based**, matching the app's
client-only/no-backend design: one engineer exports and commits the file, others
pull and import; Git history is the version trail, the `revision` field is a
human label. `state/standardsStore.ts` persists locally with corrupt-data
recovery (like the project/library stores).

**Honesty.** The shipped default is a clearly-flagged **starter template**
(`starterTemplate: true`) that `checkStandards` warns is not authoritative until
reviewed; an org approves it by unchecking the flag. No building-code
combination is ever assumed — a template cites a `standard` only when set. Edits
use a draft + Save; import/reset adopt immediately.

**Consequences.** Additive new core modules; no existing solver/core changed.
Editing uses on-blur commit (`onBlur` → React `focusout` delegation) — a synthetic
`blur` in browser verification didn't fire it (harness quirk, not an app bug);
verified via `focusout`: edit+save persists (cable factor 5→8), approve toggle
clears the starter flag, JSON round-trips. `standards.test.ts` (9) covers the
model, immutable edits, the below-1 warning, the serialization round-trip,
malformed/too-new rejection, and store seed/persist/recover. Next: **9B** project
draft library & save/load for repo sharing.

## D-018 — 8A brake curves add an ADDITIVE 1-DOF stop sim; v1 untouched  (2026-07-24, 8A)

**Decision.** So the brake curve produces a real result without touching the
validated v1 CUFTS RK4 solver (Rule 1), 8A adds a NEW pure module
`calculations/brakeStopSim.ts` — a reduced-order 1-DOF stop (RK4) driven by the
tabulated curve. `BrakeCurvePanel` (new "Brake Curves" tab) authors/imports a
curve, previews it, and runs the sim. Level 2, never certified.

**Honesty + a fix.** Force is clamped at the curve endpoints, never extrapolated.
The sim reads force via the low-level `interpolateCurve` and **summarises**
extrapolation/over-rating into ONE warning each — an initial version bubbled the
engine's per-step warning and flooded the panel with thousands of lines
(caught in browser verification). Overrun of the available stroke and
did-not-stop are reported; a constant-force curve matches the analytic
v²/(2a) stop.

**Consequences.** No existing `src/calculations` solver changed; v1 CUFTS
results unchanged. Wiring a tabulated brake into the full path-following run is a
later package. Browser-verified: default stop (1.6 ft / 0.15 s / 4.95 g, energy
balances), single rating warning, overrun + clamp warnings; no console errors.
`brakeStopSim.test.ts` (6) covers analytic agreement, determinism, clamp,
rating, overrun, and invalid input.

## D-016 — 7E BOM/procurement from an in-view sizing basket (closes M7)  (2026-07-24, 7E)

**Decision.** The sizing panel (7D) gains an "add to BOM" action that pushes its
`SizingResult` (+ rating key) into a basket held in `LibraryBrowser` view state
(sizing results are ephemeral computed data — not persisted domain data).
`LibraryProcurementPanel` renders that basket through the tested engines:
`assembleBom` for the BOM table and `reports/procurementSheet.buildProcurementSheet`
/ `procurementSheetCsv` for search phrases, RFQ text, and CSV. A no-candidate
demand becomes a **PROCUREMENT REQUIRED** line — never a fabricated part — and
an example-only selection reports **verified = no** honestly. No math in the UI
(Rules 2/7).

**Fix.** RFQ blocks are keyed by `label + index` (demand labels can repeat) — an
earlier `key=label` produced a duplicate-key warning; the BOM table keys on the
unique `itemNumber`.

**Consequences.** No `src/core`/`src/calculations` changes. Browser-verified:
BOM line 001 selected (example rope, verified=no), line 002 (500000 lbf) →
PROCUREMENT REQUIRED; CSV export + RFQ render; keys unique. `libraryProcurement.test.ts`
covers select-vs-procurement disposition, the calculated-requirement/selected/
verified distinction, and the CSV PROCUREMENT-REQUIRED marker. **Milestone 7 is
complete.**

## D-015 — 7D sizing UI presents every candidate; the engine does the math  (2026-07-24, 7D)

**Decision.** `LibrarySizingPanel` collects a demand (label, category, rating
key, demand value in active force units, design factor, optional derating,
require-verified) and calls the tested `calculations/componentSizing.sizeComponent`
over the library. It renders **every** candidate (pass / fail / insufficient /
excluded) with published rating, derated rating, utilization, margin,
verification state, and controlling criterion — never auto-selecting the
smallest passing part. No math in the component (Rules 2/7).

**Scope.** 7D covers force-valued ratings (MBS/WLL/rated capacity/proof/force
capacity) — the common sizing case; demand is entered manually (seeding a demand
from a CUFTS run is a later nicety, and custom-project analysis stays deferred).
BOM/procurement output is 7E (`assembleBom` already exists for it).

**Consequences.** No `src/core/` or `src/calculations/` changes — the panel
consumes the engine. Browser-verified: example rope shows honest fail (50000 lbf
required vs 29225 lbf derated, 171% util, exampleOnly); lowering demand → pass;
require-verified → excludedUnverified; no console errors. `librarySizing.test.ts`
pins the seed-data honesty rules, missing→insufficient, margin-ranking (largest
first, not smallest passing), and published-vs-derated separation.

## D-014 — 7C imports MERGE through mergeRecord; adapters shown read-only  (2026-07-24, 7C)

**Decision.** Library import (JSON or CSV) **merges** into the current library
via `mergeIncomingLibrary` (new pure helper in `core/library/recordEdits.ts`)
rather than replacing it, so the verified-never-overwritten rule (Rule 12)
applies per record — refused records are reported (count + reason), never
silently applied or dropped. File type is chosen by extension (`.csv` →
`importLibraryCsv`, else `importLibraryJson`); malformed files are rejected with
a visible reason. `LibraryIoPanel` also renders the source-adapter contract
read-only.

**Honesty.** CSV rows enter `importedUnverified` and an empty cell is *missing*
not 0 (handled by `libraryIo`); the UI states this. The adapter section shows
`BUILT_IN_ADAPTERS` with `validateAdapter` verdicts and says no network adapter
ships, online data is importedUnverified, search snippets are refused as proof,
and access-control-bypassing adapters are refused (Rule 12 / R-9).

**Consequences.** `recordEdits.ts` gains `mergeIncomingLibrary` (additive, pure).
Browser-verified: JSON re-import → 0 added / 7 updated; CSV import → 1 added,
record importedUnverified, mbs 50000 N, diameter missing (null, not 0); adapter
table shows both shipped adapters network-disabled/accepted; exports download; no
console errors. `libraryIoMerge.test.ts` covers the merge, the refusal path, the
JSON round-trip, the CSV empty→missing/importedUnverified rules, and adapter
compliance.

## D-013 — 7B edits records on a draft, commits via mergeRecord's refusal gate  (2026-07-24, 7B)

**Decision.** Record editing uses pure helpers in `core/library/recordEdits.ts`
(`blankRecord`/`setRecordProperty`/`removeRecordProperty`/`updateRecordProvenance`/
`updateRecordFields`) applied to a local DRAFT, committed once via `mergeRecord`.
The verified-never-overwritten-by-unverified rule (Rule 12) is enforced by
`mergeRecord` and **surfaced** — a refused save shows the returned reason and
keeps the draft so the user can fix the state. Property value + verification
state reuse the 6F `updatedQuantity` (missing → null, source value preserved).

**Why draft-then-commit.** A single `mergeRecord` per save keeps the audit
history/revision from being spammed by keystrokes and surfaces the refusal once.
Property value inputs hold local text (Apply → draft) to avoid unit-conversion
jitter. `markObsolete` retires a record (kept for history, excluded from
selection).

**Consequences.** New core module `core/library/recordEdits.ts` (additive, pure).
Browser-verified: created a record (auto-slug id, provisional), added a property
50000 lbf → 222411 N (userVerified), saved and persisted across reload; no
console errors. `libraryRecordEdits.test.ts` covers the helpers, the
verified-overwrite refusal + reason, source-value preservation, obsolete→excluded
from selection, and the edited-library JSON round-trip.

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
