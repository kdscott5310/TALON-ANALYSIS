# Current Task

> **Active package: `8B` — Coupled dynamics (wheel inertia + payload pendulum)**
> Back to the analysis stream now that collaboration (M9) is complete.

## Completed in this phase

- **8A — Brake curves & stopping simulation — DONE.** New additive
  `calculations/brakeStopSim.ts` + `BrakeCurvePanel` ("Brake Curves" tab).
- **M9 — Git-based sharing — COMPLETE.**
  - **9A** standards: `core/standards.ts` / `standardsIo.ts` / `standardsStore.ts`
    + `StandardsPanel` ("Standards" tab) — export/import JSON for Git-versioning.
  - **9B** project drafts: `core/projectDrafts.ts` + store `drafts` +
    `ProjectDraftsPanel` — named snapshots, newest-first, load to continue
    optimizing, export for repo sharing. See `DECISIONS.md` D-019, D-020.

446 tests, build clean. Milestones 6 & 7 complete.

## Objective (8B)

Give the coupled-dynamics engines a UI: **wheel rotational inertia**
(`calculations/wheelDynamics.ts`) and the **damped payload pendulum**
(`calculations/payloadPendulum.ts`), both Level 2. Collect the inputs these need
(which migrated CUFTS projects mark **missing**) and report results honestly —
*insufficient information* until real values are entered. Zero wheel inertia
must reduce EXACTLY to the M3 point-mass result.

## In scope

1. Wheel-inertia inputs + `wheelDynamics` run: effective mass (m + I/r²),
   rotational energy, wheel angular speed; show the effect vs the point mass.
2. Payload-pendulum panel running `payloadPendulum`: inputs (payload mass,
   suspension length, damping, trolley accel / brake decel, crosswind); outputs
   (peak longitudinal/lateral angles, displacement envelope, attachment
   reaction, natural period, settling time, ground-clearance rise, swing
   warnings) + a small time-history plot.
3. Missing required inputs → insufficient information, never 0. Active unit
   system throughout.
4. Tests per `TEST_REQUIREMENTS.md` §8B (add a section).

## Out of scope

- Coupling the pendulum reaction back into the trolley/cable run (M11 model).
- Changing the validated v1 dynamics solver or its results.

## Files to read (only these)

- `src/calculations/wheelDynamics.ts` and `src/calculations/payloadPendulum.ts`
  — inputs/outputs (do not change).
- `src/components/BrakeCurvePanel.tsx` — pattern for an analysis panel + plot.
- `src/units/units.ts`; `src/App.tsx` / `src/state/store.ts` — tab wiring.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 446 + new 8B tests).
- Zero wheel inertia reduces exactly to the point-mass result; the pendulum
  matches the small-angle period T = 2π√(L/g).
- Missing inputs render as insufficient information, never 0; no engineering
  math in the component (Rules 2/7); no existing `src/calculations/` solver
  modified; `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 8B DONE and 8C ACTIVE.
4. Single package-scoped commit.
