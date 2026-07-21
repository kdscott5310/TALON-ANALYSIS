# Validation, Tolerances, and Numerical Sensitivity

This document records the numerical confidence of the solvers. The
benchmark cases below are executed both in the **Validation** tab of the
application and in the CI suite (`src/tests/benchmarks.test.ts`), so the
in-app status always matches the tests.

## Benchmark cases

Each case compares a solver output against a closed-form value derived
independently of the solver.

| Category | Case | Analytical basis | Tolerance |
|---|---|---|---|
| Units | 1000 ft → m | × 0.3048 exact | 1e-9 |
| Units | 2500 lbf → N | × 4.4482216152605 exact | 1e-9 |
| Units | mass round-trip | identity | 1e-9 |
| Geometry | approach angle | atan(200/1000) = 11.3099° | 1e-5 |
| Geometry | chord length | √(1000²+200²) | 1e-9 |
| Static cable | midspan sag | d = wL²/(8H) | 1e-6 |
| Static cable | endpoint reaction | V = wL/2 | 1e-6 |
| Equilibrium | symmetric hook Fx | 0 (components cancel) | 1e-6 (abs) |
| Equilibrium | node force closure | ΣF = 0 | 1e-6 (abs) |
| Anchors | sliding SF | μW/H = 2.0 | 1e-6 |
| Dynamics | frictionless v_end | √(2gΔh) | 5e-3 |
| Dynamics | slope acceleration | a = g·sinθ | 1e-3 |
| Braking | stopping distance | d = mv₀²/(2F) | 5e-3 |
| Braking | brake work | ½mv₀² | 5e-3 |
| Braking | velocity decay | v₀·e^(−ct/m) | 5e-3 |
| Dynamics | pendulum period | 2π√(L/g) | 1e-9 |

Analytic (closed-form) benchmarks use tight tolerances (1e-6 to 1e-9).
Time-integrated dynamics benchmarks use 5e-3 (0.5%), reflecting RK4
truncation at the default time step.

## Energy audit

Every dynamic run reports an energy-balance residual:

```
residual = PE_released + KE_initial − KE_final − W_brake − W_drag − W_rolling
```

The residual is displayed in the Dynamic Analysis tab and flagged if it
exceeds **1%** of the released energy. For the baseline example scenario
at the default 0.01 s time step, the residual is ≈ 0.4%.

## Time-step sensitivity

The RK4 integrator is 4th-order accurate. Halving the time step changes
peak speed and final position by **< 0.5%** for the baseline scenario
(`dynamics.test.ts` asserts this). Recommended time steps:

| Time step | Use |
|---|---|
| 0.02 s | fast interactive exploration |
| 0.01 s | default; audit residual ≈ 0.4% |
| 0.005 s | higher-confidence runs; ~2× cost |

Time steps above 0.1 s trigger an accuracy warning; below 1e-4 s are
flagged as unnecessarily slow.

## Invariants (property tests)

`src/tests/invariants.test.ts` asserts, for the example and edge-case
scenarios:

- Master-node force equilibrium closes (< 1e-6 N) at every swept trolley
  position.
- Brake, drag, and rolling work are all ≥ 0.
- All time-history channels are finite.
- Stronger brakes stop in shorter distance; head/tailwind slow/speed the
  trolley monotonically.
- Un-entered ratings report *insufficient*, never zero/acceptable.

## Edge cases covered

Near-level cable, steep geometry (parabolic-warning path), very small sag
(high pretension), large moving load, zero / opposing / tailwind, short
brake zone (stopping-failure warning), and invalid/low ratings.

## Milestone 6 — migration equivalence

The generalized project model is validated by **equivalence**, not tolerance:
migrating a CUFTS scenario into a `Project` and analyzing it through the
adapter must reproduce the v1 results **exactly**.

`src/tests/generalizedModel.test.ts` asserts strict equality (`toBe` /
`toEqual`, no epsilon) on:

| Output | Scope |
|---|---|
| `mainLegLoaded.maxTensionN` | 5 trolley positions × 2 scenarios |
| `masterNode.hookResultantN`, `craneUtilization` | 5 positions × 2 scenarios |
| `launchAnchor.slidingSF`, `brakeAnchor.slidingSF` | 5 positions × 2 scenarios |
| `groundClearanceMarginM`, `allWarnings` | 5 positions × 2 scenarios |
| Dynamics: final position/time, peak speed/decel/brake force, termination, full energy audit, complete velocity history | 2 scenarios |
| Full status summary object | 2 scenarios + export/import round trip |

Rationale: the v1 solvers are covered by 16 analytical benchmarks and 115
tests. Re-deriving their inputs from generalized entities could introduce
silent numerical drift, so the CUFTS template keeps the `Scenario` as the
authoritative input and the adapter passes it through untouched. Any future
change that perturbs v1 numerics fails these equality tests immediately.

Provenance rules are also tested: un-entered ratings remain `missing`
(`value === null`), example data never claims `verified`, `requireValue`
throws instead of defaulting, and quantities absent from the v1 schema (EA,
unstretched length, wheel inertia) are recorded as missing with a note naming
the milestone that will need them.

## Milestone 6 — platform-contract verification

Beyond the migration-equivalence suite above, `src/tests/platformCore.test.ts`
verifies the governance rules structurally rather than by convention:

| Rule | How it is verified |
|---|---|
| 1 — never certified | Every `ResultBadge` reports `certificationStatus: 'Not certified'`; asserted on construction |
| 2 — acceptance | Full truth table over the acceptance inputs: missing data, non-convergence, divergence, out-of-range applicability, unknown ratings, demand exceeding rating, and open critical risks each block an acceptable verdict |
| 3 — missing ≠ zero | Missing quantities are `null`; derating a missing value stays null; `requireValue` throws |
| 4 — unverified ≠ verified | `isVerified()` returns false for supplier-listed, imported-unverified, example, estimated, provisional, and obsolete states |
| 5 — derating preserves source | `derate()` writes `value` while retaining the published figure in `sourceValue`, plus factor and rule |
| 6 — units and frames | Every quantity carries dimension + SI unit; frame transforms tested including rotation and circular-reference rejection |
| 9 — reproducibility | Fingerprints are order-independent and stable across runs; frozen runs reject mutation; snapshots survive later mutation of the caller's objects |
| 11 — reduced-order labeling | Built-in solvers assert `reducedOrder: true`; future element types are flagged; Level 3 cannot be claimed without an imported external result |

**Dimensional consistency (release gate 3)** is checked by exercising the
dimensional algebra against known relationships: force × length = energy,
length ÷ time = velocity, velocity ÷ time = acceleration, force ÷ length =
stiffness, and mass ÷ length = linear density. Incompatible pairs (force vs.
length, velocity vs. acceleration) are asserted incompatible.

Note: energy and moment share base-unit exponents (kg·m²·s⁻²), so they are
dimensionally compatible by design; the distinction is semantic and carried by
the dimension tag, not by the exponents.

## Test summary

`npm test` runs **186 tests** across 10 suites: units, static solvers,
dynamics, scenario workflow/serialization, benchmarks, invariants, input
validation, ground clearance, the generalized model, and the platform core.
All pass from a clean checkout.
