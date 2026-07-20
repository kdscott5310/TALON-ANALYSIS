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
- [x] Vitest tests for units, validation, and layout geometry (28 tests)
- [x] npm install / npm test / npm run build all pass

## Milestone 2 — Static Engineering Solvers (NEXT)
- [ ] Parabolic cable solver per leg
- [ ] Master-ring vector equilibrium
- [ ] Crane resultant + capacity margin
- [ ] Anchor reactions, sliding/uplift checks
- [ ] Results cards, force vectors, warnings

## Assumptions register (Milestone 1)
- Master node horizontal station equals launch-anchor offset from launch station (crane at high-point station).
- Cable legs drawn as nominal geometric chords only; not the loaded profile (per spec Critical Modeling Correction, chords are labeled as layout reference).
- Example scenario values (cable linear mass 0.11 kg/m, MBS 30,000 lbf, block mass 4,000 lb, μ = 0.5, DAF 1.5, crane capacity 8,600 lbf) are PROVISIONAL and labeled unverified.

## Unresolved-input register
- Manufacturer-certified cable properties (MBS, linear mass, stiffness)
- Field-verified ecology-block weight and ground friction coefficient
- Crane-company-approved capacity at radius and side-load allowances
