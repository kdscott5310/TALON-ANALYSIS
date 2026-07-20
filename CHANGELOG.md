# CHANGELOG

## v0.5.0 — Milestone 4: Engineering Workflow, Scenarios, and Reports
- Added versioned scenario serialization (schema v2) with export envelope, strict structural import validation (typed fields, whitelisted enums, unknown fields dropped), and v1→v2 migration that fills missing Milestone-3 fields with labeled PROVISIONAL defaults and discloses every fill as a migration note (`src/models/scenarioSerialization.ts`).
- Rebuilt the store as a multi-scenario library: create, duplicate, rename, delete, import, export, active selection, and compare selection, persisted to localStorage with corrupt-data recovery (discard + visible notice + built-in example fallback) (`src/state/store.ts`).
- Added the status summary engine with five status categories — ok, caution, failed, insufficient (not evaluated, never shown as zero/acceptable), and error — computing static peaks over a 21-position trolley sweep plus dynamic simulation results, with per-item traceability (units kind, solver/model, source inputs, assumptions) (`src/calculations/statusSummary.ts`).
- Added workflow navigation tabs (Setup / Static Analysis / Dynamic Analysis / Compare / Report) and a scenario toolbar (`src/App.tsx`, `src/components/ScenarioBar.tsx`).
- Added the assumptions and unresolved-input registers to the interface, combined with live solver assumptions for the active scenario (`src/components/RegistersPanel.tsx`).
- Added the comparison view: selected scenarios side by side with status coloring, critical warnings, validation counts, traceability tooltips, and an empty state (`src/components/CompareView.tsx`).
- Added the printable engineering report: project metadata (configuration, date, application revision, schema version, data status), results summary with solver/assumption columns, embedded system diagram and time-history plots, complete input tables with PROVISIONAL flags and NOT ENTERED markers, validation issues, and the persistent disclaimer; browser print/Save-as-PDF with print CSS, no server required (`src/components/ReportView.tsx`, `src/reports/reportData.ts`).
- Added CSV export for summary results (SI values, status, traceability, disclaimer; insufficient checks export an empty value — never zero) and dynamic time histories (`src/reports/csv.ts`).
- Added WeakMap-memoized summary computation shared by Compare and Report (`src/state/useSummary.ts`).
- Accessibility: toolbar/tablist roles, aria-selected tabs, focus-visible outlines, labeled controls, and useful empty/error states.
- Added 16 Vitest tests covering serialization round-trip, import rejection paths, migration disclosure and migrated-data solver usability, status categories, report data assembly, and CSV content/escaping (`src/tests/scenarioWorkflow.test.ts`).
- Total test count: 91 (15 units + 13 validation + 27 static + 20 dynamics + 16 workflow).

## v0.4.0 — Milestone 3: Trolley Dynamics and Progressive Braking
- Added trolley path builder: influence line of the parabolic cable (elevation of the load point with the trolley at x), analytic slope, arc-length parameterization with interpolators, and uphill-segment detection (`src/calculations/trolleyPath.ts`).
- Added time-step trolley dynamics solver: classical RK4 on (s, v) with gravity along the local path tangent, rolling resistance (C_rr·m·g·cosθ), aerodynamic drag on relative wind, along-track wind, and one-directional motion clamping; termination on stop, stall, end-of-path, time limit, or non-finite state, all reported — never NaN (`src/calculations/trolleyDynamics.ts`).
- Added three selectable brake laws (constant force, linear ramp over the available stroke, velocity-proportional) engaged at the brake-zone start with per-step work integration.
- Added energy audit: potential released, kinetic at release/brake entry, brake/drag/rolling work, final kinetic, and balance residual displayed in joules and percent with a 1% warning threshold.
- Added dynamics orchestrator: builds the path from the Milestone-2 static solution, runs the simulation, and evaluates user-entered limits (max allowable speed, allowable deceleration, brake capacity, trolley structural rating) plus a user-DAF-amplified peak brake force; un-entered ratings (0) produce advisory "not evaluated" warnings — no rating is ever invented (`src/calculations/dynamicsAnalysis.ts`).
- Extended the scenario model: trolley rolling-resistance coefficient, drag area Cd·A, structural rating; brake law/force/velocity coefficient/capacity; environment along-track wind and air density; dynamics settings (release position/speed, time step, time limit) — all validated with errors and advisory warnings (`src/models/scenario.ts`, `src/validation/validate.ts`).
- Added Dynamics & Braking results card: run outcome, stopping performance vs available stroke, peak deceleration vs allowable, energy audit, prioritized warnings (critical → caution → advisory), and assumptions list (`src/components/DynamicsPanel.tsx`).
- Added compact SVG time-history charts (speed, position, acceleration, brake force vs time) with limit reference lines and a playback cursor (`src/components/TimeHistoryCharts.tsx`).
- Added playback controls (play/pause/replay, 0.25×/1×/4× speed, time scrubber) driving the animated trolley on the side view via the shared store; setInterval-driven so playback survives backgrounded tabs (`src/components/SimControls.tsx`).
- Added shared WeakMap-memoized dynamics hook so panels/charts/controls reuse one simulation per scenario (`src/state/useDynamics.ts`).
- Added area and energy unit conversions (ft², ft·lbf) and speed/energy display formatters (`src/units/units.ts`).
- Added 20 Vitest dynamics tests with hand-calculation benchmarks: straight-path geometry, sagged-path midspan elevation, frictionless energy conservation (v² = 2gΔh), constant acceleration (a = g·sinθ), constant-force stopping distance (d = mv²/2F), velocity-proportional decay (v = v₀e^(−ct/m)), linear-ramp half-stroke force, rolling-resistance stopping distance, stopping-failure warning, tailwind effect, time-step sensitivity (< 0.5% at dt/2), determinism, invalid-input rejection, and orchestrator end-to-end on the example scenario.
- Total test count: 75 (15 units + 13 validation + 27 static solvers + 20 dynamics).

## v0.3.0 — Milestone 2: Static Engineering Solvers
- Added parabolic cable solver with documented equations (Irvine reference), explicit assumptions, convergence reporting, and configurable pretension (`src/calculations/parabolicCable.ts`).
- Added master-ring vector equilibrium solver combining backstay, main leg, and rigging weight to produce crane hook resultant magnitude, direction, included angle, dynamic amplified load, and crane utilization (`src/calculations/masterNode.ts`).
- Added anchor sliding and uplift check with Newton-3 sign analysis, net-normal-force calculation, and safety-factor evaluation (`src/calculations/anchorCheck.ts`).
- Added static analysis orchestrator that runs all solvers for a given scenario and trolley position, computes ground clearance margin, and collects all warnings and assumptions (`src/calculations/staticAnalysis.ts`).
- Updated SVG side view with solved parabolic cable profiles (backstay, unloaded main, loaded main) drawn as solid curves distinct from dashed nominal chords. Added force-vector arrows at the master node with magnitude labels. Added legend.
- Added trolley position slider (0–100% of main span) that updates all solver results and SVG in real time.
- Replaced results placeholder with detailed results cards: layout geometry, cable tensions (loaded), crane/master node, anchors, and ground clearance, all with conditional warning highlighting.
- Updated warnings panel to display solver warnings alongside input validation issues.
- Added Zustand store trolley-position state with clamped setter.
- Added 27 Vitest solver tests covering 7 benchmarks: symmetric level cable, sloped cable, point-load deflection on massless cable, equal-tension symmetric node equilibrium, unequal-tension resultant, anchor sliding, and full-scenario orchestrator with vector-equilibrium closure verified to < 0.01 N.
- Added CSS for cable profiles, trolley slider, results details, and warning rows.
- Total test count: 55 (15 units + 13 validation + 27 solvers).

## v0.2.0 — Milestone 1: Working Foundation
- Added Vite + React 18 + TypeScript application scaffold (`package.json`, `vite.config.ts`, `tsconfig*`, `index.html`).
- Added SI-internal unit conversion module with exact NIST factors and display formatters (`src/units/units.ts`).
- Added typed domain models for site, cable, trolley, crane, anchors, brake, and environment (`src/models/scenario.ts`).
- Added clearly labeled unverified baseline example scenario mirroring PROJECT_SPEC Section 17 (`src/models/exampleScenario.ts`).
- Added scenario validation with blocking errors and advisory warnings (`src/validation/validate.ts`).
- Added nominal layout geometry helpers — chords/angles only, no cable-force equations (`src/calculations/layoutGeometry.ts`).
- Added Zustand app store with unit-system toggle (`src/state/store.ts`).
- Added UI: grouped input panel with unit-boundary conversion, responsive SVG side view (anchors, master node, crane, trolley, payload, brake/capture zones, dimensions), results placeholder, warnings panel, persistent validation disclaimer.
- Added 28 Vitest tests covering unit conversions (with hand-calculation benchmarks), validation error/warning behavior, and layout geometry.
- Fixed kg/m → lb/ft inverse conversion bug caught by round-trip test.

## v0.1.0
- Repository initialized.
- Documentation structure created.
