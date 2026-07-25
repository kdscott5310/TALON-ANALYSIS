# File Map — active source

Purpose-per-file index of the live `src/` tree, so an agent can load only what a
package touches instead of scanning the repo. Tests are summarized at the end.
Legend: **[UI]** used by the shipping v1 app · **[core]** platform engine ·
**[engine]** solver, React-free · **[headless]** built + tested, no UI yet.

## Entry points

| File | Purpose |
|---|---|
| `src/main.tsx` | React bootstrap. **[UI]** |
| `src/App.tsx` | App shell + workflow tabs (Setup/Static/Dynamic/3D/Compare/Report/Validation). **[UI]** |
| `src/version.ts` | App version string. |
| `src/styles.css` | Global styles. **[UI]** |

## `src/core` — platform model (M6) & libraries (M7, M14)

| File | Purpose |
|---|---|
| `core/model.ts` | `Project` aggregate + integrity checks. **[core]** central target of 6A. |
| `core/dimensions.ts` | Dimensional types, SI units, runtime dimensional algebra. **[core]** |
| `core/coordinates.ts` | 8 coordinate-frame kinds, rotations, frame-tagged vectors. **[core]** |
| `core/provenance.ts` | Verification states; derating preserves source value. **[core]** |
| `core/solver.ts` | Solver contract: fidelity, applicability, acceptance rule, certification badge. **[core]** |
| `core/analysisRun.ts` | Frozen, fingerprinted, reproducible analysis runs. **[core]** |
| `core/elements.ts` | Element types (+ export-only future types). **[core]** |
| `core/projectAnalysis.ts` | Orchestrates solvers over a Project. **[core] [headless]** |
| `core/projectSerialization.ts` | Project JSON + migration from Scenario v1/v2/v3. **[core] [headless]** |
| `core/templates/registry.ts` | Fixture-template registry (only CUFTS implemented; others throw). **[core]** |
| `core/templates/cufts.ts` | CUFTS as first fixture template; v1 results unchanged. **[core]** |
| `core/library/componentLibrary.ts` | Versioned component library, record/property provenance, merge rules. **[headless]** target of 7A/7B. |
| `core/library/libraryIo.ts` | Library JSON round-trip + CSV import/export. **[headless]** target of 7C. |
| `core/library/sourceAdapters.ts` | Online-retrieval adapter contract + compliance gating (no network adapter ships). **[headless]** |
| `core/library/seedLibrary.ts` | Example-only seed records (carry no manufacturer/part number). **[headless]** |
| `core/fmea.ts` | FMEA / hazard register engine (S/O/D, RPN, open-risk propagation). **[headless]** |

## `src/calculations` — solvers (React-free, SI, unit-tested)

| File | Purpose | Level |
|---|---|---|
| `parabolicCable.ts` | Parabolic cable statics (Irvine approx). **[engine] [UI]** | 1 |
| `masterNode.ts` | Master-node vector equilibrium. **[engine] [UI]** | 1 |
| `anchorCheck.ts` | Coulomb sliding + dead-weight uplift checks. **[engine] [UI]** | 1 |
| `staticAnalysis.ts` | Static sweep over trolley position. **[engine] [UI]** | 1 |
| `layoutGeometry.ts` | Site/layout geometry. **[engine] [UI]** | 1 |
| `trolleyPath.ts` | Influence-line trolley path. **[engine] [UI]** | 1 |
| `trolleyDynamics.ts` | RK4 point-mass trolley dynamics. **[engine] [UI]** | 1 |
| `dynamicsAnalysis.ts` | Dynamics run assembly + energy audit. **[engine] [UI]** | 1 |
| `brakeCurves.ts` | Idealized laws + imported curve interpolation (clamped). **[engine]** partial UI | 1–2 |
| `statusSummary.ts` | Five-category status engine. **[engine] [UI]** | 1 |
| `benchmarks.ts` | In-app validation benchmark cases. **[engine] [UI]** | — |
| `elasticCatenary.ts` | Elastic-catenary cable (Newton, analytic Jacobian). **[engine] [headless]** | 2 |
| `wheelDynamics.ts` | Wheel rotational inertia (effective mass). **[engine] [headless]** | 2 |
| `payloadPendulum.ts` | Damped longitudinal/lateral pendulum. **[engine] [headless]** | 2 |
| `lateralCableDynamics.ts` | Reduced-order out-of-plane cable dynamics. **[engine] [headless]** | 2 |
| `sensitivity.ts` | One-at-a-time sensitivity, tornado, exceedance. **[engine] [headless]** | 2 |
| `optimization.ts` | Bounded constrained optimizer (feasibility-explicit). **[engine] [headless]** | 2 |
| `componentSizing.ts` | Demand→candidate sizing, derating, ranking. **[engine] [headless]** target of 7D. | 2 |
| `trussFEM.ts` | 2D pin-jointed truss direct-stiffness solver. **[engine] [headless]** | 2 |
| `testCorrelation.ts` | Predicted/measured correlation + parameter estimation. **[engine] [headless]** | 2 |

## `src/models` — v1 domain (current UI runs on this)

| File | Purpose |
|---|---|
| `models/scenario.ts` | Flat v1 `Scenario` type + `DISCLAIMER`. **[UI]** |
| `models/exampleScenario.ts` | Built-in CUFTS example. **[UI]** |
| `models/scenarioSerialization.ts` | Scenario JSON + v1→v3 migration. **[UI]** |

## `src/state`, `src/units`, `src/validation`, `src/reports`, `src/visualizations`

| File | Purpose |
|---|---|
| `state/store.ts` | Zustand scenario library, persistence, workflow tabs. **[UI]** (6A adds a Project store beside it) |
| `state/useDynamics.ts` | Dynamics run hook. **[UI]** |
| `state/useSummary.ts` | Status-summary hook. **[UI]** |
| `units/units.ts` | SI unit system + US-customary display conversion. **[UI] [engine boundary]** |
| `validation/validate.ts` | Input validation: blocking errors vs advisory warnings. **[UI]** |
| `reports/reportData.ts` | Report data assembly. **[UI]** |
| `reports/csv.ts` | CSV export (summary + time histories). **[UI]** |
| `reports/procurementSheet.ts` | Procurement search sheet / RFQ / CSV. **[headless]** target of 7E. |
| `visualizations/sceneData.ts` | Pure solver→3D scene mapping (Rule 7 boundary). **[UI]** |

## `src/components` — React UI (v1 tabs + 3D)

`InputPanel`, `NumberField`, `SideView`, `ResultsPanel`, `WarningsPanel`,
`DynamicsPanel`, `SimControls`, `TimeHistoryCharts`, `ScenarioBar`,
`RegistersPanel`, `CompareView`, `ReportView`, `ValidationView`,
`Scene3D` + `VisualizationView` (lazy Three.js), `ErrorBoundary`,
`formatSummary.ts`. **[UI]** — all bound to the v1 Scenario model today. New
editor/library components (M6/M7) will be added here, not replacing these.

## `src/tests` — Vitest (21 files, 334 tests)

Platform/core: `platformCore.test.ts`, `generalizedModel.test.ts`,
`componentLibrary.test.ts`, `fmea.test.ts`. Solvers: `staticSolvers`,
`dynamics`, `coupledDynamics`, `elasticCatenary`, `lateralCableDynamics`,
`brakeCurves`, `componentSizing`, `uncertaintyOptim`, `trussFEM`,
`testCorrelation`, `sceneData`, `benchmarks`, `groundClearance`. Workflow/units:
`scenarioWorkflow`, `units`, `validation`, `invariants`. New packages add
sibling `*.test.ts` files here.

## Config (not source, but load-bearing)

`index.html`, `vite.config.ts`, `tsconfig*.json`, `.claude/launch.json`
(dev-server preview config), `package.json`.
