# Current Task

> **Active package: `8B` — Coupled dynamics (wheel inertia + payload pendulum)**
> Only 8B is active. When complete, advance to 8C (optimization).

## Previously completed (this phase)

- **8A — Brake curves & stopping simulation — DONE (2026-07-24).** New additive
  `calculations/brakeStopSim.ts` (reduced-order 1-DOF stop) + `BrakeCurvePanel`
  on a new "Brake Curves" tab; author/import a curve, preview, simulate the
  stop. v1 CUFTS untouched. 427 tests. See `DECISIONS.md` D-018.
- Milestones 6 & 7 complete.

## Objective (8B)

Give the coupled-dynamics engines a UI: **wheel rotational inertia**
(`calculations/wheelDynamics.ts`) and the **damped payload pendulum**
(`calculations/payloadPendulum.ts`), both Level 2. Let the user enter the data
these need (wheel inertia/radius/count, payload mass/suspension/damping, drive
inputs) — which migrated CUFTS projects mark **missing** — and show results
honestly (insufficient information until entered). Zero wheel inertia must
reduce EXACTLY to the M3 point-mass result.

## In scope

1. A UI (new tab or a section) collecting the wheel-inertia inputs and running
   `wheelDynamics` (effective-mass, rotational energy, wheel speed); show the
   effective mass and how it changes the stop/energy vs the point mass.
2. A payload-pendulum panel running `payloadPendulum` (longitudinal + lateral
   damped swing): inputs (payload mass, suspension length, damping, trolley
   accel/brake decel, crosswind), outputs (peak angles, displacement envelope,
   attachment reaction, natural period, settling time, ground-clearance rise,
   swing warnings) + a small time-history plot.
3. Missing required inputs → *insufficient information*, never 0. Values in the
   active unit system.
4. Tests per `TEST_REQUIREMENTS.md` §8B (add a section).

## Out of scope

- Full coupling of the pendulum reaction back into the trolley/cable run (that
  is the M11 reduced-order 3D model, separate).
- Changing the validated v1 dynamics solver or its results.

## Files to read (only these)

- `src/calculations/wheelDynamics.ts` — inputs/outputs, effective-mass formula,
  zero-inertia reduction (do not change).
- `src/calculations/payloadPendulum.ts` — inputs/outputs, damped RK4 (do not
  change).
- `src/units/units.ts` — display; `src/App.tsx` / `src/state/store.ts` — tab.
- `src/components/BrakeCurvePanel.tsx` — pattern for an analysis panel + plot.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 427 + new 8B tests).
- Zero wheel inertia reduces exactly to the point-mass result; the pendulum
  matches the small-angle period T = 2π√(L/g) (engine already tested — assert
  the wiring surfaces these honestly).
- Missing inputs render as insufficient information, never 0; no engineering
  math in the component (Rules 2/7); no `src/calculations/` changes;
  `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 8B DONE and 8C ACTIVE.
4. Single package-scoped commit.
