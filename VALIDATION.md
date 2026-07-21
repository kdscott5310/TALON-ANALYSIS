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

## Test summary

`npm test` runs **108 tests** across 7 suites: units, static solvers,
dynamics, scenario workflow/serialization, benchmarks, invariants, and
input validation. All pass from a clean checkout.
