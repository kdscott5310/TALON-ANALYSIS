# TASKLIST

## Milestone 1 — Working Foundation (COMPLETE)
- [x] Vite + React + TypeScript project scaffold
- [x] Clean src/ structure (components, models, units, validation, calculations, state, tests)
- [x] Typed models: site geometry, cable, trolley/payload, crane, anchors, brake, environment
- [x] Internal SI units with US-customary conversion functions
- [x] Input validation with errors (blocking) and warnings (advisory)
- [x] Scenario state (Zustand) with clearly labeled unverified example
- [x] Grouped input panel, results placeholder, warnings panel
- [x] Responsive SVG side view: launch anchor, master node/crane, brake anchor, chords, trolley, dimensions, ground line, brake/capture zones
- [x] Persistent preliminary-design/professional-validation disclaimer
- [x] Vitest tests for units and validation
- [x] npm install / npm test / npm run build all pass

## Milestone 2 — Static Engineering Solvers (COMPLETE)
- [x] Parabolic cable solver for each cable leg (documented assumptions, equations referenced to Irvine)
- [x] Cable profile points, sag, lowest elevation, ground clearance, horizontal tension, endpoint vertical reactions, resultant tension
- [x] Cable self-weight (distributed per horizontal projection), trolley/payload point load, configurable pretension
- [x] Pretension-to-H iterative solver with convergence reporting
- [x] Master-ring vector equilibrium: backstay, main leg, rigging weight → crane hook resultant
- [x] Crane hook resultant magnitude, direction, angle from vertical, dynamic amplified load
- [x] User-entered crane-capacity comparison with utilization/margin (never invents crane chart)
- [x] Anchor horizontal/vertical reactions with Newton-3 sign analysis
- [x] Preliminary sliding check (friction × net normal / horizontal pull)
- [x] Preliminary uplift check (anchor weight / vertical pull)
- [x] Tension/capacity utilization for cable (MBS/DF vs max tension)
- [x] Results cards: layout geometry, cable tensions (loaded), crane/master node, anchors, ground clearance
- [x] SVG cable profile overlay: backstay, unloaded main, loaded main (distinct from dashed nominal chords)
- [x] Force-vector arrows at master node (backstay, main leg, hook reaction) with magnitude labels
- [x] Trolley position slider (0–100% of main span) updates all results and SVG
- [x] Prioritized safety warnings from solvers displayed in warnings panel
- [x] Solver input/output types, explicit assumptions lists, convergence/error reporting
- [x] 27 Vitest solver tests: symmetric level cable, sloped cable, point load deflection, equal-tension symmetric node, unequal-tension node, rigging weight addition, DAF scaling, anchor sliding benchmark, uplift reduction, full orchestrator, vector equilibrium closure (< 0.01 N), error handling
- [x] Force vectors close within documented 0.01 N numerical tolerance
- [x] Capacity values user-supplied and labeled PROVISIONAL / preliminary
- [x] Failures throw or produce visible warnings; never NaN or silent defaults
- [x] npm test (55 tests) and npm run build pass

## Milestone 3 — Trolley Dynamics and Progressive Braking (NEXT)
- [ ] Path coordinate along solved cable profile
- [ ] Time-step trolley dynamics (gravity, rolling resistance, drag, wind, cable slope)
- [ ] Brake-zone engagement with selectable brake laws
- [ ] Energy conservation accounting
- [ ] Time-history plots and animated trolley position

## Assumptions register
- Master node horizontal station equals launch-anchor offset from launch station.
- Cable legs drawn as parabolic approximation: load distributed per horizontal projection, no bending stiffness, no elastic elongation, no wind/temperature geometry effects.
- Parabolic model appropriate when sag/span < 0.08 and chord slope < 30°; warnings issued when violated.
- Pretension sets H via iterative solver on the unloaded cable; loaded case uses the same H (neglects geometric stiffening; elastic catenary is a future milestone).
- Point-load deflection uses the simple-beam analogy under the parabolic assumption.
- Ground elevation under the main leg is linearly interpolated between master-node ground and brake-anchor ground.
- Example scenario values are PROVISIONAL and labeled unverified.

## Unresolved-input register
- Manufacturer-certified cable properties (MBS, linear mass, stiffness, creep, temperature limits)
- Field-verified ecology-block weight and ground friction coefficient
- Crane-company-approved capacity at radius, side-load allowances, dynamic allowances
- Proof-pull procedures and base-level connection details for ecology-block anchor clusters
