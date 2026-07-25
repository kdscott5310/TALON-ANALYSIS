# Milestones — M6 & M7 UI phase

Two milestones, split into small work packages so each fits one focused,
token-efficient session. The engineering **cores already exist** (see
`docs/architecture/CURRENT_ARCHITECTURE.md`); this phase builds the **UI/platform
layer** that consumes them.

- **M6 — Generalized platform + graphical fixture editor** → `6A … 6H`
- **M7 — Component library + procurement** → `7A … 7E`

Rules: one package per change set; do not scope-creep into a later package;
every package satisfies `TEST_REQUIREMENTS.md` and keeps `npm test` +
`npm run build` green. Status pointer of record is `status.json`.

Status legend: **ACTIVE** · **TODO** · **DONE** · **BLOCKED**.

---

## M6 — Generalized platform + graphical fixture editor

Adopt the `core/model.ts` `Project` as a runtime model in the UI and add a 2D
graphical fixture editor, without disturbing the v1 CUFTS UI or its locked
Level-1 results. Depends on the M6 core (already built).

### 6A — Project store & app shell — **ACTIVE**

- **Goal.** A `Project`-backed Zustand store mounted beside the existing v1
  store, able to hold, persist, and hydrate a `Project`, with a minimal shell
  entry (a new tab/route) that reads it — no editing yet.
- **Scope.** New `src/state/projectStore.ts` wrapping `core/model.ts` +
  `core/projectSerialization.ts`; localStorage persistence with corrupt-data
  recovery mirroring `store.ts`; a placeholder "Fixture Editor" surface that
  displays the loaded Project's identity/metadata read-only.
- **Key files.** `core/model.ts`, `core/projectSerialization.ts`,
  `core/templates/cufts.ts` (to seed an initial Project), `state/store.ts`
  (pattern reference), `App.tsx` (mount new surface).
- **Acceptance.** App builds and runs with both stores; existing v1 tabs
  unchanged; a Project can be created (from CUFTS template), persisted, and
  reloaded across a refresh; corrupt persisted Project data recovers with a
  visible notice, never a silent default.
- **Out of scope.** Any canvas/editing (6C+), template picker UI (6B),
  solver runs (6G).
- **Depends on.** M6 core. **Blocks.** 6B–6H.

### 6B — Template gallery & new-project flow — TODO

- **Goal.** Choose a fixture template and instantiate a `Project`.
- **Scope.** Read `core/templates/registry.ts`; gallery lists all templates with
  CUFTS enabled and the rest visibly locked; selecting CUFTS creates a Project
  via the template into the 6A store.
- **Acceptance.** Only implemented templates can be instantiated; attempting a
  locked template is prevented in the UI (registry already throws); created
  Project matches the template definition.
- **Depends on.** 6A.

### 6C — Canvas foundation — TODO

- **Goal.** A 2D editor canvas that renders the Project read-only.
- **Scope.** Pan/zoom/grid, active coordinate-frame indicator, render nodes and
  elements from the store; selection highlighting only (no mutation).
- **Acceptance.** Nodes/elements render at correct coordinates in the stated
  frame; pan/zoom stable; no calculation logic in canvas code (Rule 2/7).
- **Depends on.** 6A (6B recommended).

### 6D — Node & element editing — TODO

- **Goal.** Build fixture geometry graphically.
- **Scope.** Add/move/delete nodes; create/delete elements (cable, strut, anchor
  link, etc. per `core/elements.ts`); grid/endpoint snapping; live dimension
  readout; edits commit through the Project store immutably.
- **Acceptance.** Editing produces a valid Project (integrity check passes);
  undoable via store history or equivalent; dimensions shown in the active unit
  system via `units/units.ts`.
- **Depends on.** 6C.

### 6E — Supports, constraints & loads — TODO

- **Goal.** Define boundary conditions and loading through the editor.
- **Scope.** Assign supports/constraints to nodes; define loads, load cases, and
  user combinations (no hard-coded code factors — Rule); frame-tagged load
  vectors.
- **Acceptance.** Supports/constraints/loads persist on the Project; load
  combinations are user-defined only; vectors state their coordinate frame.
- **Depends on.** 6D.

### 6F — Property inspector & provenance — TODO

- **Goal.** Inspect and edit any selected entity's properties with units and
  provenance.
- **Scope.** Inspector panel bound to selection; edit dimension-tagged
  properties (validated via `core/dimensions.ts`); show/set verification state
  and source via `core/provenance.ts`; missing values shown as *missing*, never
  0.
- **Acceptance.** Property edits are dimensionally checked; verification state
  and source round-trip; a missing property never renders as 0 or "OK".
- **Depends on.** 6D (6E recommended).

### 6G — Analysis-run wiring & fidelity badges — TODO

- **Goal.** Run solvers from the editor and show honest result badges.
- **Scope.** Invoke solvers through `core/solver.ts` / `core/projectAnalysis.ts`
  producing frozen runs (`core/analysisRun.ts`); render fidelity level, solver
  id/version, applicability, convergence, and certification-status badge on
  results; reuse `visualizations/sceneData.ts` for any geometry.
- **Acceptance.** Results carry full metadata (Rule 7); runs are
  frozen/reproducible; no Level claim exceeds what was computed; failed/
  non-convergent/insufficient cases display as such, not as OK.
- **Depends on.** 6D (6E, 6F recommended).

### 6H — Serialization, migration & regression — TODO

- **Goal.** Durable Project persistence and provable CUFTS equivalence.
- **Scope.** Project JSON export/import; migrate existing v1 scenarios into
  Projects via `core/projectSerialization.ts`; end-to-end exact-equality
  regression of CUFTS static/dynamic/summary vs v1.
- **Acceptance.** Round-trip serialization lossless; v1 scenarios migrate with
  disclosed notes and no data loss; CUFTS results bit-for-bit identical to v1.
- **Depends on.** 6A–6G. **Closes.** M6.

---

## M7 — Component library & procurement

Give the M7/M13 component-library, sizing, and procurement engines a UI.
Depends on M6 (needs the Project + demands) and the already-built
`core/library/`, `calculations/componentSizing.ts`,
`reports/procurementSheet.ts`.

### 7A — Library store & browse — TODO

- **Goal.** Load and browse the component library.
- **Scope.** `src/state/libraryStore.ts` over `core/library/componentLibrary.ts`
  + `seedLibrary.ts`; list/filter records by category; show verification state
  and provenance; seeds visibly example-only.
- **Acceptance.** Records list with correct verification badges; seeded records
  never display as verified; persistence recovers corrupt data with a notice.
- **Depends on.** 6A (store pattern).

### 7B — Record & property editor with provenance — TODO

- **Goal.** Create and edit component records and their property provenance.
- **Scope.** Record/property editor writing through `componentLibrary.ts`;
  per-property source type, document, URL, dates, derating rule, verification
  state, confidence; enforce that a verified record is never overwritten by
  unverified data.
- **Acceptance.** Provenance fields round-trip; verified-over-unverified
  overwrite is blocked; derating preserves the original source value (Rule 5).
- **Depends on.** 7A.

### 7C — Import/export & source adapters UI — TODO

- **Goal.** Move library data in/out and attach sources.
- **Scope.** JSON/CSV import-export via `core/library/libraryIo.ts`; imported
  records enter as `importedUnverified`; empty CSV cells become *missing*, not
  0; surface the `sourceAdapters.ts` compliance gating (no network adapter
  ships); allow attaching a source doc/URL and citing a page.
- **Acceptance.** CSV import never asserts verification; missing cells are
  missing; imported data is marked unverified with URL + retrieval date.
- **Depends on.** 7A (7B recommended).

### 7D — Sizing & candidate selection — TODO

- **Goal.** Turn calculated demands into ranked hardware candidates.
- **Scope.** Feed Project/analysis demands into
  `calculations/componentSizing.ts`; show each candidate's demand, published
  rating, derated rating, utilization, controlling criterion, verification
  state, and source; rank without auto-selecting the smallest passing part;
  missing rating → insufficient information.
- **Acceptance.** No auto-pick of smallest passing candidate without showing
  alternatives; obsolete/unverified excluded when verified data is required;
  missing rating never adequate.
- **Depends on.** 7A, 6G (demands). 

### 7E — BOM & procurement sheet — TODO

- **Goal.** Assemble the BOM and generate procurement outputs.
- **Scope.** BOM assembly; procurement search sheet, RFQ text, and CSV via
  `reports/procurementSheet.ts`; outputs distinguish calculated requirement /
  recommended minimum / selected component / verified component; a no-candidate
  demand becomes a procurement line, never a fabricated part.
- **Acceptance.** Exports carry the four-way distinction and mark unselected
  demands PROCUREMENT REQUIRED; no fabricated parts.
- **Depends on.** 7D. **Closes.** M7.

---

## Dependency summary

```
6A → 6B → 6C → 6D → 6E
        └──────→ 6C ...        (6C needs 6A; 6B recommended)
6D → 6F
6D → 6G ─────────────────→ 7D
6A..6G → 6H (closes M6)
6A → 7A → 7B
7A → 7C
7A + 6G → 7D → 7E (closes M7)
```

Active pointer and per-package status live in `status.json`. Only **6A** is
active; do not begin any other package.
