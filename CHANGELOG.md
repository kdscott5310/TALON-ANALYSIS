# CHANGELOG

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
