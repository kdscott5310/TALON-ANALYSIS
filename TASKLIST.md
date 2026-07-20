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

## Milestone 3 — Trolley Dynamics and Progressive Braking (COMPLETE)
- [x] Trolley path coordinate along the solved cable profile (influence line, analytic slope, arc length)
- [x] Time-step RK4 trolley model: gravity along local tangent, rolling resistance, aerodynamic drag, along-track wind
- [x] Release position and release-speed options
- [x] Configurable time step, time-limit guard, stall/overrun/non-finite termination handling
- [x] Outputs: position, elevation, speed, acceleration, elapsed time, peak values
- [x] Brake-zone start from site geometry; available stopping distance check
- [x] Three selectable brake laws: constant force, linear ramp, velocity-proportional
- [x] Brake work/energy integration; stopping position/time, peak deceleration, peak force, residual speed
- [x] Energy audit: KE + PE entering brake zone vs brake work; residual displayed and warned above 1%
- [x] User-entered limits: brake capacity, allowable deceleration, trolley structural rating, DAF for brake-anchor demand (0 = not entered → advisory, never silently passed)
- [x] Time-history SVG charts (speed, position, acceleration, brake force) with limit reference lines and playback cursor
- [x] Animated/scrubbable trolley playback (play/pause/speed) synchronized with the static side view
- [x] 20 new Vitest tests: straight-path geometry, sagged-path benchmark, energy conservation, constant-acceleration, constant-force stopping distance, velocity-proportional decay, linear-ramp force, rolling-resistance stopping, stopping failure, tailwind effect, dt sensitivity (<0.5% at dt/2), determinism, invalid inputs, orchestrator end-to-end
- [x] Deterministic simulation; warnings prioritized critical → caution → advisory
- [x] npm test (75 tests) and npm run build pass

## Milestone 4 — UI, Reports and Scenarios (NEXT)
- [ ] Scenario save/load (JSON) and comparison
- [ ] Front/top/force/brake-detail views
- [ ] Report exports (CSV/JSON, crane-company sheet)
- [ ] BOM and cost panels

## Assumptions register
- Master node horizontal station equals launch-anchor offset from launch station.
- Cable legs drawn as parabolic approximation: load distributed per horizontal projection, no bending stiffness, no elastic elongation, no wind/temperature geometry effects.
- Parabolic model appropriate when sag/span < 0.08 and chord slope < 30°; warnings issued when violated.
- Pretension sets H via iterative solver on the unloaded cable; loaded case uses the same H (neglects geometric stiffening; elastic catenary is a future milestone).
- Point-load deflection uses the simple-beam analogy under the parabolic assumption.
- Ground elevation under the main leg is linearly interpolated between master-node ground and brake-anchor ground.
- Example scenario values are PROVISIONAL and labeled unverified.
- (M3) Trolley path is the influence line of the M2 parabolic cable: elevation of the load point with the trolley at x; its gradient is the effective slope (energy-consistent for a quasi-static cable).
- (M3) Cable responds quasi-statically; cable inertia, elastic stretch, and longitudinal waves neglected.
- (M3) Point-mass trolley: payload pendulum, wheel rotating inertia, and lateral sway neglected (later milestone).
- (M3) Rolling resistance = C_rr·m·g·cosθ while moving; motion is one-directional (no backward roll; stalls are reported).
- (M3) Brake laws are idealized (constant / linear ramp / velocity-proportional); real hardware response requires manufacturer data.
- (M3) User-entered DAF applied to peak brake force as a preliminary brake-anchor/cable dynamic demand; coupled cable–brake transients are a later milestone.
- (M3) Example C_rr = 0.015, Cd·A = 0.4 m², brake force 900 lbf, air density 1.225 kg/m³ are PROVISIONAL.

## Unresolved-input register
- Manufacturer-certified cable properties (MBS, linear mass, stiffness, creep, temperature limits)
- Field-verified ecology-block weight and ground friction coefficient
- Crane-company-approved capacity at radius, side-load allowances, dynamic allowances
- Proof-pull procedures and base-level connection details for ecology-block anchor clusters
- Trolley rolling-resistance coefficient and drag area (require rolldown/wind-tunnel or field test)
- Brake hardware capacity and force-vs-stroke curve (require manufacturer data; example uses idealized laws)
- Trolley structural rating (requires trolley design and proof test)
