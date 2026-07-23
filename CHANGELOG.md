# CHANGELOG

## Unreleased — Milestone 9: Wheel inertia and payload pendulum (Level 2)
- Added `src/calculations/wheelDynamics.ts`: wheel rotational inertia captured as an effective translational mass `m_eff = m + I_total/r²` under rolling without slip. Inertia is entered directly or estimated from geometry as `I = k·m·r²` (k reported so an estimate is never mistaken for measured data). Provides rotational energy and wheel angular speed. Zero wheel inertia reduces **exactly** to the Milestone 3 point-mass acceleration a = F/m.
- Added `src/calculations/payloadPendulum.ts`: an RK4-integrated damped pendulum with decoupled longitudinal (pitch, forced by trolley acceleration and braking) and lateral (sway, forced by crosswind and gust drag) modes. Reports peak pitch/sway, displacement envelope, attachment reaction, natural period, settling time, ground-clearance rise, and warnings when the swing exceeds a permitted angle or the small-angle regime.
- Registered `payload-pendulum` (v1.0.0, Level 2, reduced-order) in the solver registry.
- Added 20 tests (`src/tests/coupledDynamics.test.ts`): zero-inertia reduction, `m_eff` and uniform-disc inertia formulas, the small-angle period T = 2π·√(L/g), damped-vs-undamped settling, acceleration→pitch and crosswind→sway decoupling, the hard-brake large-swing warning path, determinism, and invalid-input rejection.
- Total test count: 243 (228 + 15). Build clean; audit unchanged (dev-only, R-0).
- **Deferred (honestly):** wheel slip and bearing-loss sub-models, and feedback of the pendulum reaction into the trolley/cable — that coupling is the Milestone 11 reduced-order 3D cable model.

## Unreleased — Milestone 8: Nonlinear elastic cable analysis (Level 2)
- Added `src/calculations/elasticCatenary.ts`, an exact elastic-catenary solver (Irvine, "Cable Structures", 1981) that solves the two geometric-closure equations by Newton iteration with an analytic Jacobian on the end-force components (H, V). This is TALON's first **fidelity Level 2** engineering model.
- Accounts for unstretched length, axial stiffness EA, self-weight, support elevation difference, temperature strain, and constructional-stretch/creep allowance (applied as an effective change in unstretched length).
- Reports everything Rule 6 requires: convergence status, iteration count, force and geometric-closure residuals, cable profile, lowest point, tension and strain distribution, support reactions, elastic elongation, maximum sag, and an explicit comparison against the parabolic model.
- Handles the failure modes explicitly rather than returning a clean result: invalid or non-positive EA (never defaulted), a physically too-short cable, invalid span/geometry, non-convergence, a singular Jacobian, and near-zero-tension slack. High axial strain and near-vertical geometry are flagged as applicability cautions.
- Registered `cable-elastic-catenary` (v1.0.0, Level 2, reduced-order, benchmark-verified) in the solver registry.
- Added 15 tests (`src/tests/elasticCatenary.test.ts`): catenary→parabolic reduction in the small-sag limit, the shallow-cable relation H = w·L²/(8·sag), elastic elongation matching T·L/EA, temperature-driven sag change, sloped-span tension ordering, resolution-independent converged forces, determinism, and the full set of failure/edge cases.
- Corrected a vertical sign convention in the committed solver draft: the profile bowed upward (so maximum sag read as 0). The z-closure residual and profile now sag physically; the (H, V) equilibrium solve was already correct.
- Total test count: 228 (213 from M7 + 15 catenary). Build clean; `npm audit` unchanged (dev-only, accepted R-0).
- **Deferred (honestly):** segmented multi-element nonlinear cable and moving-load geometric stiffening — the elastic catenary covers the core requirement; segmented discretization is follow-on within M8's scope.

## Unreleased — Milestone 6: Generalized platform model

Second and final pass of Milestone 6 under the expanded 17-milestone platform
plan. Builds on the generalized model below and adds the platform contracts.

- Added **dimensional quantity types** (`src/core/dimensions.ts`): 24 dimensions with canonical SI units and base-unit exponents, runtime dimensional algebra (`productDimension`, `quotientDimension`, `dimensionsCompatible`), and compile-time dimension tags on `Quantity<D>` so a force cannot be passed where a length is expected (release gate 3).
- Added the **eight coordinate-system kinds** (`src/core/coordinates.ts`) — global, local element, crane, trolley-path, wind, payload-body, sensor, customer/range — with parent chains, direction-cosine rotation, circular-reference detection, node roles, and `FrameVector`, so every vector result states the frame it is expressed in (Rule 6).
- Expanded **provenance** to the specified verification states (manufacturer verified, user verified, internally tested, supplier listed, provisional, estimated, example only, imported unverified, obsolete, missing). `isVerified()` deliberately excludes supplier listings and imported data (Rules 4, 12). `derate()` writes the working value while preserving the original published figure in `sourceValue` (Rule 5).
- Added **solver contracts** (`src/core/solver.ts`): fidelity Levels 0–3 with `assertFidelityClaim` refusing an unearned Level 3; a 7-state applicability engine; `overallAcceptance()` as the single place Rule 2 is decided (never acceptable with missing data, failed/non-converged solves, out-of-range models, unknown ratings, demand exceeding rating, or open critical risks); and a `ResultBadge` whose certification status is always "Not certified" (Rule 1). Built-in v1 solvers are registered as Level 1, reduced-order (Rule 11).
- Added **immutable analysis runs** (`src/core/analysisRun.ts`): deep-frozen records carrying project/fixture/scenario/schema revisions, solver version, source commit, component-library revision, deep-copied input snapshot, settings, units, coordinate systems, results, warnings, applicability, convergence, and open risks — with an order-independent FNV-1a fingerprint for tamper detection. Documented as a change-detection checksum, not a cryptographic hash.
- Expanded the **element set** to cable, elastic cable, segmented cable, truss, rigid link, linear spring, nonlinear spring, viscous damper, point mass, rigid body, pulley/sheave, brake force, contact/stop, and support element; beam, frame, shell-export, and solid-export are declared for forward compatibility and flagged by `isFutureElementType` as not analyzed (Rule 11).
- Added the **fixture-template registry** (`src/core/templates/registry.ts`): 13 templates declared with honest implemented/planned status and owning milestone. `instantiateTemplate` throws for planned templates rather than returning an empty or guessed model.
- Expanded **Project** with identity/customer/test program, load combinations (no building-code factors assumed), analysis runs, risks, assumptions, test data, reports, BOM lines, revisions, and review status; integrity checking now covers coordinate-system parents, load combinations, and report→run references.
- CUFTS template now emits crane and trolley-path frames, ballast anchors as support elements, a service load combination, and the v1 modeling assumptions each with a resolution path naming the milestone that retires it.
- Added 44 platform-core tests (`src/tests/platformCore.test.ts`) covering dimensional algebra, frame transforms, derating provenance, the full acceptance truth table, fidelity gating, run immutability and tamper detection, and template-registry honesty.
- Rewrote [ROADMAP_V2.md](ROADMAP_V2.md) for the 17-milestone plan with governance rules, fidelity levels, release gates, and a risk register including the documented dev-toolchain exception.
- Total test count: 186 (115 v1 unchanged + 27 generalized model + 44 platform core).
- No UI or solver behavior changed; the platform layer remains additive.

## Superseded — Milestone 6 first pass: Generalized model architecture
- Added `src/core/`, a reusable project model for cable-supported test fixtures, moving-trolley systems, crane-supported fixtures, and portable test structures. Pure data, no React, SI throughout (Rules 5–6).
- Added provenance-carrying quantities (`src/core/provenance.ts`): every engineering property records value + SI unit + verification state (**verified / provisional / estimated / example / missing**), source, reference, date, confidence, and derating. A missing rating is `value: null` and is structurally incapable of being read as zero; `requireValue` throws rather than defaulting (Rules 2–3).
- Added geometry primitives (`src/core/geometry.ts`): 3D vectors, coordinate systems, and nodes. The CUFTS template is planar (y = 0) but the schema is 3D from the start so the M8 lateral cable model and M11 3D views need no schema break.
- Added materials and seven element types (`src/core/elements.ts`): cable, truss, rigid link, linear spring, viscous damper, point mass, and brake/contact. The cable element already carries EA, unstretched length, creep allowance, and damping for M7/M8.
- Added the `Project` aggregate (`src/core/model.ts`): components, supports (incl. prescribed motion), constraints (incl. node-on-path), loads, load cases, moving bodies (incl. wheel inertia and pendulum parameters for M8), analysis cases, solver results (convergence, iterations, residuals, assumptions, applicability limits per Rule 4), and verification metadata — plus a referential-integrity checker.
- Preserved CUFTS as a built-in template (`src/core/templates/cufts.ts`): it projects the generalized topology (nodes, cables, trolley mass, brake element, supports, load cases, moving body, analysis cases) from the v1 `Scenario` while keeping that `Scenario` authoritative, so the validated v1 solvers run **unchanged** behind an adapter (`src/core/projectAnalysis.ts`).
- Added versioned project serialization with migration (`src/core/projectSerialization.ts`): opens generalized project files and legacy CUFTS scenario files (schema v1/v2/v3), disclosing every migrated field as a note and rejecting malformed, future-versioned, or unknown-template files with explicit errors.
- Added 27 tests (`src/tests/generalizedModel.test.ts`) asserting **exact equality** of static, dynamic, and status-summary results before and after migration, plus template topology, provenance rules (un-entered ratings stay missing, example data never claims verified), serialization round-trips, rejection paths, and integrity checking.
- Added [ROADMAP_V2.md](ROADMAP_V2.md) covering Milestones 6–13 with dependencies, acceptance criteria, test requirements, the future-FEA path, and a risk register.
- Total test count: 142 (115 pre-existing, unchanged + 27 new).
- No UI or solver behavior changed in this milestone; the generalized model is additive.

## v1.1.0 — Ground-clearance model fix (capture height + flight-zone scope)
- Decoupled the downhill capture terminus from the terrain: `brakeAnchorElevationM` is now the capture-point / cable-terminus elevation, and a new `captureHeightAboveGroundM` site input (≥ 0, default 0) sets how far the capture sits above local grade. The clearance check measures against `brakeAnchorElevationM − captureHeightAboveGroundM` instead of pinning the capture to the ground (`src/models/scenario.ts`, `src/calculations/staticAnalysis.ts`).
- Scoped the minimum-ground-clearance requirement to the flight span only — up to brake-zone entry — excluding the brake and capture zones where the trolley deliberately descends to the capture. This removes the false failure caused by the terminus necessarily reaching capture elevation (`src/calculations/staticAnalysis.ts`). Fixes the reported "Ground clearance margin −4.0 ft FAILED" case, which was the capture terminus at grade rather than a real flight-path clearance problem.
- Bumped the scenario schema to v3 with v2→v3 migration filling `captureHeightAboveGroundM = 0` and disclosing the fill; generalized the migration note for any older version; import validation now accepts schema versions 1–3 (`src/models/scenarioSerialization.ts`).
- Added input validation (capture height ≥ 0, advisory when it exceeds the capture-point elevation), the two site inputs in the panel, a report row, and updated the status-summary traceability text (`src/validation/validate.ts`, `src/components/InputPanel.tsx`, `src/reports/reportData.ts`, `src/calculations/statusSummary.ts`).
- Added 7 tests (`src/tests/groundClearance.test.ts`): reproduces the reported scenario and confirms it is no longer failed by the terminus, verifies flight-zone exclusion, capture-height monotonicity, v2→v3 migration, and validation of a negative capture height.
- Total test count: 115 (108 + 7 ground-clearance).

## v1.0.0 — Milestone 5: Validation, Hardening, and Release
- Added an independent benchmark validation suite: 16 hand-calculable cases across units, geometry, static cable, master-node equilibrium, anchors, dynamics, and braking, each comparing a solver output against a closed-form expected value derived independently of the solver (`src/calculations/benchmarks.ts`).
- Added the in-app Validation tab showing expected vs calculated, relative error, tolerance, and pass/fail per case, grouped by category; the same cases run in CI so the displayed status matches the test suite (`src/components/ValidationView.tsx`).
- Added `benchmarks.test.ts` (4 tests) and `invariants.test.ts` (13 tests): property/invariant checks (master-node force-balance closure < 1e-6 N over swept positions, nonnegative energy dissipation, monotonic brake behavior, finite outputs) and edge cases (near-level cable, steep geometry, small sag, large moving load, zero/opposing/tailwind, short brake zone, invalid/low ratings).
- Added an application-wide React error boundary with a diagnostic message and recovery actions; a failing panel can no longer blank the whole app (`src/components/ErrorBoundary.tsx`, wired in `src/main.tsx`).
- Added requirements traceability matrix (`TRACEABILITY.md`), numerical-tolerance and time-step-sensitivity documentation (`VALIDATION.md`), model/safety limitations (`SAFETY_LIMITATIONS.md`), release notes (`RELEASE_NOTES.md`), and a full rewrite of `README.md` (setup, use, models, verification status, static-host deployment).
- Repository hygiene: removed tracked artifacts (`files.zip`, `talon-*.bundle`, `talon-milestone1.patch`, `CHATGPT_WRITE_TEST.txt`) and hardened `.gitignore`; `npm audit` reports 0 vulnerabilities; runtime dependencies (react, react-dom, zustand) confirmed in use.
- Total test count: 108 (15 units + 27 static + 20 dynamics + 16 workflow + 13 invariants + 4 benchmarks + 13 validation).

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
