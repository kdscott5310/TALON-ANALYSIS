# Target Architecture (M6/M7 UI phase)

Where the platform is going. The goal is a **`Project`-model-backed product with
a graphical fixture editor** that consumes the already-built M6–M17 engines and
surfaces fidelity/provenance honestly. For today's state see
`CURRENT_ARCHITECTURE.md`.

## Design intent

1. Make `core/model.ts` `Project` the **single runtime source of truth** for new
   work, without breaking the v1 CUFTS UI or its locked Level-1 results.
2. Let users **build fixtures graphically** (nodes, elements, supports,
   constraints, loads) instead of editing a flat form.
3. Run the existing solvers through the **`core/solver.ts` contract** so every
   result shows fidelity, applicability, convergence, and certification status.
4. Give the **component library and procurement** engines a real UI.
5. Keep every safety invariant from `ROADMAP_V2.md` intact.

## Target layered view

```
┌──────────────────────────────────────────────────────────────────┐
│ React UI                                                          │
│  ┌────────────────────────────┐  ┌────────────────────────────┐  │
│  │ Fixture Editor (NEW, M6)   │  │ Library + Procurement (M7) │  │
│  │  canvas · inspector ·      │  │  browse · record editor ·  │  │
│  │  template gallery          │  │  sizing · BOM/RFQ          │  │
│  └─────────────┬──────────────┘  └──────────────┬─────────────┘  │
│  Existing v1 tabs stay available during transition.              │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                                │
┌───────────────▼────────────────┐  ┌────────────▼─────────────────┐
│ Project store (NEW, M6)         │  │ Library store (NEW, M7)      │
│  Zustand; holds a Project       │  │  component library, records, │
│  aggregate; persistence +       │  │  verification states,        │
│  migration from v1 Scenario.    │  │  import/export.              │
└───────────────┬────────────────┘  └────────────┬─────────────────┘
                │ builds/reads                    │
┌───────────────▼─────────────────────────────────▼────────────────┐
│ Platform core (src/core) — model, dimensions, coordinates,        │
│  provenance, solver contract, analysisRun, templates, library     │
└───────────────┬───────────────────────────────────────────────────┘
                │ runs solvers via contract
┌───────────────▼───────────────────────────────────────────────────┐
│ Solvers (src/calculations) — Levels 1–2, unchanged, React-free     │
└───────────────┬───────────────────────────────────────────────────┘
                │ results only
┌───────────────▼───────────────────────────────────────────────────┐
│ Visualization (src/visualizations) — pure result→scene mapping     │
└────────────────────────────────────────────────────────────────────┘
```

## Fixture editor (M6, packages 6A–6H)

A 2D graphical editor that constructs a `Project` directly.

- **Project store & app shell (6A)** — a `Project`-backed Zustand store that can
  hold, persist, and hydrate a Project, mounted beside the v1 store without
  disturbing existing tabs.
- **Template gallery & new-project flow (6B)** — instantiate a Project from the
  fixture-template registry; only CUFTS is implemented, others are visibly
  locked and cannot be instantiated.
- **Canvas foundation (6C)** — pan/zoom/grid, active coordinate frame, read-only
  render of Project nodes/elements from the store.
- **Node & element editing (6D)** — add/move/delete nodes; create elements
  (cable, strut, anchor link…) with snapping and live dimensions.
- **Supports, constraints & loads (6E)** — assign supports/constraints; define
  loads, load cases, and combinations through the editor (no hard-coded code
  factors).
- **Property inspector & provenance (6F)** — select an entity; edit
  dimension-tagged properties with units; show/set verification state and
  source.
- **Analysis-run wiring & badges (6G)** — run solvers through the contract from
  the editor; render immutable run results with fidelity / applicability /
  convergence / certification badges.
- **Serialization, migration & regression (6H)** — persist Project JSON; migrate
  v1 scenarios into Projects; assert exact-equality CUFTS regression end-to-end.

**Editor is presentation + orchestration only.** It builds model data and
displays results; it performs no engineering math (Rule 2/7).

## Component library & procurement (M7, packages 7A–7E)

- **Library store & browse (7A)** — load `core/library`, list/filter records,
  show verification states and provenance.
- **Record & property editor (7B)** — create/edit records and per-property
  source metadata; a verified record is never overwritten by unverified data.
- **Import/export & source adapters UI (7C)** — JSON/CSV import-export; imported
  data enters as `importedUnverified`; attach source docs/URLs and cite pages.
- **Sizing & candidate selection (7D)** — feed calculated demands into
  `componentSizing`; show ranked candidates with derating, utilization, and the
  controlling criterion; never auto-pick the smallest passing part.
- **BOM & procurement sheet (7E)** — assemble the BOM; generate procurement
  search sheet / RFQ / CSV; distinguish calculated requirement / recommended
  minimum / selected component / verified component.

## Invariants preserved end-to-end

- v1 CUFTS Level-1 results stay bit-for-bit identical (regression, 6H).
- SI internal; conversion only at `units/units.ts`.
- Solvers and rendering remain React-free and calculation-free respectively.
- Missing data → *insufficient information*, never zero, never OK.
- Provenance preserved; unverified never shown as certified.
- Every result badge states fidelity, applicability, convergence, and
  certification status.
- Analysis runs are frozen and reproducible.
- No backend introduced; static deploy preserved; production audit stays 0.

## Explicitly out of scope for this phase

- New engineering solvers or fidelity levels (the engines already exist).
- Level-3 external-solver integration beyond the existing neutral FE export.
- Monte Carlo sampling, segmented nonlinear cable, full multibody coupling
  (documented carry-forwards, not part of M6/M7).
- Any server, database, or authenticated service.
