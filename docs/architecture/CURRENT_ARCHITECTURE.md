# Current Architecture (as built)

Snapshot of what is actually in `main` today. This is the starting point for
the M6/M7 UI phase. For where we are going, see `TARGET_ARCHITECTURE.md`.

## One-paragraph summary

TALON is a client-only Vite/React/TypeScript app. The **shipping UI is still the
v1.1.0 CUFTS planner**, driven by the flat `Scenario` model and a Zustand store.
Underneath it sits a large, tested **platform core (M6) and solver library
(M7–M17)** that the UI does **not** yet consume. The product therefore has two
loosely connected halves: a working-but-narrow v1 UI, and a broad-but-headless
engineering engine.

## Layered view

```
┌──────────────────────────────────────────────────────────────┐
│ React UI (src/components, src/App.tsx)                        │
│   Tabs: Setup · Static · Dynamic · 3D View · Compare ·        │
│         Report · Validation                                   │
│   Runs entirely on the v1 Scenario model.                     │
└───────────────┬──────────────────────────────────────────────┘
                │ reads/writes
┌───────────────▼──────────────────────────────────────────────┐
│ State (src/state/store.ts — Zustand)                          │
│   Scenario library, localStorage persistence + recovery,      │
│   workflow tab, playback. Keyed on Scenario, NOT Project.     │
└───────────────┬──────────────────────────────────────────────┘
                │ calls
┌───────────────▼──────────────────────────────────────────────┐
│ v1 domain (src/models, src/validation, src/reports)          │
│   Scenario type, migration v1→v3, input validation, report    │
│   assembly, CSV.                                              │
└───────────────┬──────────────────────────────────────────────┘
                │ calls (v1 solvers, Level 1)
┌───────────────▼──────────────────────────────────────────────┐
│ Solvers (src/calculations) — React-independent, SI, tested    │
│   Level 1: parabolicCable, masterNode, anchorCheck,           │
│            staticAnalysis, trolleyPath/Dynamics, brakeCurves…  │
│   Level 2 (NOT wired to UI): elasticCatenary, wheelDynamics,  │
│            payloadPendulum, lateralCableDynamics, sensitivity, │
│            optimization, componentSizing, trussFEM,           │
│            testCorrelation                                     │
└───────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │ Platform core (src/core) — BUILT, TESTED, MOSTLY HEADLESS    │
  │   model.ts (Project aggregate), dimensions, coordinates,     │
  │   provenance, solver contract, analysisRun (frozen runs),    │
  │   elements, templates/ (CUFTS only), library/ (components),  │
  │   fmea.ts                                                    │
  │   Consumed by tests; the shipping UI does not use it yet.    │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │ Visualization (src/visualizations/sceneData.ts + Scene3D)    │
  │   Pure solver→scene mapping. The 3D View tab uses it; it     │
  │   reads v1 scenario-derived results today.                   │
  └─────────────────────────────────────────────────────────────┘
```

## What works today (v1 UI)

- Setup / Static / Dynamic tabs edit a `Scenario` and show parabolic-cable
  statics, master-node equilibrium, anchor checks, ground clearance, RK4
  trolley dynamics with three brake laws, energy audit, and time histories.
- Scenario library: create / duplicate / rename / delete / import / export as
  versioned JSON, localStorage-persisted with corrupt-data recovery.
- Compare, printable Report, CSV export, in-app Validation benchmark panel.
- 3D View (lazy Three.js) renders the fixture, zones, force vectors, clearance
  and sway envelopes in engineering and customer/operator modes.

All of the above is **Level 1** fidelity.

## What exists but is not in the product

Built and unit-tested in `src/core` and `src/calculations`, with **no UI**:

| Capability | Module | Milestone |
|---|---|---|
| Generalized `Project` model, dimensions, frames | `core/model.ts`, `core/dimensions.ts`, `core/coordinates.ts` | M6 |
| Provenance / verification states | `core/provenance.ts` | M6 |
| Solver contract + fidelity/applicability/badge | `core/solver.ts` | M6 |
| Immutable, fingerprinted analysis runs | `core/analysisRun.ts` | M6 |
| Fixture-template registry (CUFTS impl.) | `core/templates/` | M6 |
| Component library + IO + source adapters | `core/library/` | M7 |
| Elastic catenary (Level 2 cable) | `calculations/elasticCatenary.ts` | M8 |
| Wheel inertia + payload pendulum | `calculations/wheelDynamics.ts`, `payloadPendulum.ts` | M9 |
| Imported brake curves | `calculations/brakeCurves.ts` (partial UI) | M10 |
| Lateral / out-of-plane cable dynamics | `calculations/lateralCableDynamics.ts` | M11 |
| Uncertainty / sensitivity / optimization | `calculations/sensitivity.ts`, `optimization.ts` | M12 |
| Component sizing + BOM + procurement sheet | `calculations/componentSizing.ts`, `reports/procurementSheet.ts` | M13 |
| FMEA / hazard register | `core/fmea.ts` | M14 |
| Digital-twin correlation + parameter estimation | `calculations/testCorrelation.ts` | M16 |
| 2D truss direct-stiffness + neutral FE export | `calculations/trussFEM.ts` | M17 |

## Key boundaries (already enforced)

- **SI-internal.** Only `units/units.ts` converts to/from US customary.
- **Solvers are React-free.** Nothing in `calculations/` or `core/` imports
  React; tests exercise them directly.
- **Rendering is calculation-free.** `visualizations/sceneData.ts` maps solver
  results to geometry only.
- **CUFTS results are locked.** Regression tests assert exact-equality of the
  migrated CUFTS template against v1 outputs.

## The central gap

There are **two models** for the same domain:

- `src/models/scenario.ts` — flat v1 `Scenario`. The UI uses this.
- `src/core/model.ts` — generalized `Project` aggregate. The engine uses this.

Nothing in the running app converts one to the other at runtime, and no editor
builds a `Project` directly. Closing that gap — a `Project`-backed store, a
graphical fixture editor, and result badges — is the whole point of the M6/M7
UI phase.

## Constraints that shape the next phase

- No backend; everything stays client-side and static-deployable.
- The v1 UI and its Level-1 results must keep working unchanged during the
  transition (parallel models, not a rip-and-replace).
- Dev-toolchain audit advisories (R-0) are accepted and out of scope for
  feature work; production audit stays at 0.
