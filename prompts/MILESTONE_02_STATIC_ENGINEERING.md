# Milestone 2 — Static Engineering Solvers

Continue from completed Milestone 1. Read only relevant specification sections. Do not redesign the application or restate requirements.

## Goal
Deliver a tested static-analysis vertical slice that converts user inputs into cable geometry, tensions, crane load, anchor reactions, margins, and warnings.

## Implement now
- Parabolic cable solver for each cable leg using documented assumptions.
- Cable profile points, sag, lowest elevation, ground clearance, horizontal tension, endpoint vertical reaction, and resultant tension.
- Cable self-weight, trolley/payload point load where applicable, and configurable pretension.
- Master-ring vector equilibrium combining launch leg, test leg, rigging, trolley effects, and environmental loads already defined by the specification.
- Crane hook resultant magnitude and direction.
- User-entered crane-capacity comparison with utilization and margin; never invent a crane chart.
- Anchor horizontal/vertical/resultant reactions.
- Preliminary sliding and uplift checks using user-entered anchor weight, friction coefficient, and safety factors.
- Tension/capacity utilization for cable and rigging using user-entered ratings.
- Results cards, cable profile plot/SVG overlay, force-vector display, and prioritized safety warnings.
- Solver input/output types, explicit assumptions, convergence/error reporting, and Vitest equation tests.

## Do not implement yet
Elastic catenary, segmented nonlinear cable, moving-trolley time simulation, sway dynamics, Monte Carlo analysis, PDF reports, or optimization.

## Verification
Include hand-checkable benchmark cases such as symmetric level supports and zero-load/invalid-input boundaries. Document equations and expected tolerances in tests.

## Completion checklist
- All static results change correctly with geometry, mass, cable weight, and pretension.
- Force vectors close within a documented numerical tolerance.
- Capacity values are user supplied and labeled preliminary.
- Failures produce visible errors, never NaN or silent defaults.
- `npm test` and `npm run build` pass.
- `TASKLIST.md` and `CHANGELOG.md` updated.
- Commit the milestone before stopping.
