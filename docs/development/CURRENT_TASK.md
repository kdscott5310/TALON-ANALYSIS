# Current Task

> **Active package: `8D` — Digital twin (measured-data correlation)**
> Final package of M8, and the last of the four analysis capabilities the user
> requested. Only 8D is active.

## Completed in this phase

- **8A** brake curves & stopping simulation ("Brake Curves" tab).
- **8B** coupled dynamics — wheel inertia + payload pendulum ("Coupled
  Dynamics" tab).
- **8C — Optimization — DONE (2026-07-30).** `calculations/cuftsObjective.ts`
  (additive objective adapter over the validated v1 solvers; baseline vector
  reproduces v1 results exactly) + `OptimizationPanel` ("Optimization" tab):
  feasibility, controlling constraints, baseline→optimized metrics, sensitivity,
  search history, disclosed feasibility tolerance with "at limit" labelling.
  468 tests. See `DECISIONS.md` D-022.
- **M9 — Git-based sharing — COMPLETE** (9A standards, 9B project drafts).
- Milestones 6 & 7 complete.

## Objective (8D)

Give the digital-twin engine (`calculations/testCorrelation.ts`) a UI: import
measured test channels, correlate predicted vs measured (RMSE, peak error,
timing error, R², residuals), and run parameter estimation to calibrate a model
against real data — with identifiability warnings. **Raw measured data is never
overwritten** (Rule: M16 governance).

## In scope

1. Import measured channel data (CSV: time + one or more channels). Preserve the
   RAW file/text separately from any conditioned copy (Rule 5) — conditioning
   (scale/polarity/zero offset, filtering) must not destroy the original.
2. Correlate a predicted signal against a measured one: RMSE, peak error,
   peak-value error, timing error (best time-shift alignment), integral/energy
   error, R², plus a residual plot and an overlay plot.
3. Parameter estimation: recover a calibration parameter by minimizing RMSE, and
   surface the engine's **identifiability warning** when the data cannot
   constrain the parameter — never present an unidentifiable fit as confident.
4. Label calibrated results as derived-from-test and still preliminary; never
   certified.
5. Tests per `TEST_REQUIREMENTS.md` §8D (add a section).

## Out of scope

- Persisting calibrated scenario copies into the project store (later).
- Changing the v1 solvers or their results.
- Auto-applying an estimated parameter back into the design without the user
  explicitly choosing to.

## Files to read (only these)

- `src/calculations/testCorrelation.ts` — channel model, conditioning,
  correlation metrics, parameter estimation, identifiability (do not change).
- `src/components/BrakeCurvePanel.tsx` — CSV-import + plot pattern to mirror.
- `src/components/OptimizationPanel.tsx` — results/warnings presentation pattern.
- `src/units/units.ts` — display conversion.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 468 + new 8D tests).
- Raw imported data is preserved and never mutated by conditioning.
- Correlation metrics match the engine; an unidentifiable parameter is flagged,
  not presented as a confident fit.
- No engineering math in the component (Rules 2/7); no existing
  `src/calculations/` solver modified; `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 8D DONE — **M8 complete**, and
   all four requested analysis capabilities delivered.
4. Single package-scoped commit.
