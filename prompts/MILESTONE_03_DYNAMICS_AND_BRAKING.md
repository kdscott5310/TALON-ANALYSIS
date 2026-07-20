# Milestone 3 — Trolley Dynamics and Progressive Braking

Continue from completed Milestones 1–2. Preserve existing tested static solvers. Read only relevant dynamics and brake sections of the repository specifications.

## Goal
Simulate trolley travel along the downhill cable and verify that the selected progressive brake can absorb the required energy within the available stopping distance and force limits.

## Implement now
- Path coordinate along the solved downhill cable profile.
- Time-step trolley model including gravity along path, rolling resistance, aerodynamic drag, configurable wind component, and cable slope.
- Initial position and release-speed options.
- Stable numerical integration with configurable time step, termination conditions, and visible non-convergence/error handling.
- Outputs for position, elevation, speed, acceleration, elapsed time, and peak values.
- Brake-zone start and available stopping distance.
- At least three selectable preliminary brake laws: constant force, linear ramp, and velocity-proportional force.
- Brake work/energy integration, stopping position, stopping time, peak deceleration, peak brake force, and residual speed.
- Compare kinetic plus potential energy entering the brake zone against absorbed brake energy.
- User-entered limits for brake capacity, allowable deceleration, trolley rating, and cable/anchor dynamic amplification.
- Time-history plots and animated or scrub-able trolley position on the system SVG.
- Tests for energy conservation in idealized cases, constant-acceleration benchmarks, brake stopping-distance benchmarks, and invalid inputs.

## Scope control
Do not implement full multibody UAS pendulum behavior, CFD, finite-element cable analysis, Monte Carlo analysis, optimization, or hardware control. A simple optional lateral-sway approximation may be added only after all required items pass.

## Completion checklist
- Simulation is deterministic for identical inputs.
- Energy accounting and numerical error are displayed.
- Time-step sensitivity is tested and documented.
- Unsafe stopping, excessive deceleration, or brake-capacity exceedance creates prominent warnings.
- No dynamic factor or rating is invented; inputs and assumptions are visible.
- `npm test` and `npm run build` pass.
- `TASKLIST.md` and `CHANGELOG.md` updated.
- Commit the milestone before stopping.
