# Current Task

> **Active package: `8C` — Optimization over CUFTS parameters**
> Third package of M8. Only 8C is active.

## Completed in this phase

- **8A** brake curves & stopping simulation ("Brake Curves" tab).
- **8B — Coupled dynamics — DONE (2026-07-30).** `CoupledDynamicsPanel`
  ("Coupled Dynamics" tab): wheel rotational inertia (m_eff = m + I/r²) and the
  damped payload pendulum. Blank inputs render *insufficient information*, never
  0. Verified against hand calcs (m_eff 916 kg; period 4.01 s = 2π√(L/g)).
  See `DECISIONS.md` D-021.
- **M9 — Git-based sharing — COMPLETE** (9A standards, 9B project drafts).
- Milestones 6 & 7 complete. 455 tests.

## Objective (8C)

Wire the tested bounded/constrained optimizer
(`calculations/optimization.ts`) to real CUFTS design parameters so an engineer
can search for a better design — with an explicit feasibility flag, the
controlling constraint, and the search history. **Infeasible must never be
dressed up as a best-effort answer** (Rule: R-6).

## ⚠️ Needs an objective adapter (the reason this is the heaviest package)

The optimizer exists but was never connected to anything that varies CUFTS
inputs and re-runs a solver. 8C must add a small, pure **objective adapter**
that, given a parameter vector (e.g. pretension, brake force/zone length, anchor
mass), builds a modified `Scenario`, runs the existing v1 solvers, and returns
the objective + constraint values. Keep it additive:

- Put it in a NEW module (e.g. `calculations/cuftsObjective.ts`) — do **not**
  modify the validated v1 solvers.
- Evaluating the baseline parameter vector must reproduce the current v1
  results exactly (assert it), so optimization never silently changes a
  validated number.
- A non-finite / failed solve must be rejected by the optimizer, not scored.

## In scope

1. `calculations/cuftsObjective.ts` (new, pure): parameter vector → modified
   scenario → v1 solver run → { objective, constraints }. Documented parameter
   bounds; deterministic.
2. An optimization UI: pick the objective (e.g. minimise peak cable tension or
   stopping distance), select which parameters to vary with bounds, set
   constraints, run, and show: best design, feasibility flag, controlling
   constraint, per-parameter local sensitivity, and the search history.
3. Honest reporting: infeasible problems say so; each candidate keeps its
   evaluation reason; results are Level 1/2 as computed, never certified.
4. Tests per `TEST_REQUIREMENTS.md` §8C (add a section).

## Out of scope

- Monte Carlo / uncertainty sampling UI (that is the M12 uncertainty half —
  can follow as 8C2 if wanted).
- Changing the v1 solvers or their results.
- Optimizing custom (non-CUFTS) projects — analysis for those is still deferred.

## Files to read (only these)

- `src/calculations/optimization.ts` — optimizer API, feasibility/controlling
  constraint/search-history outputs (do not change).
- `src/calculations/sensitivity.ts` — for local sensitivity reporting.
- `src/models/scenario.ts` + `src/models/exampleScenario.ts` — the parameters to
  vary.
- `src/calculations/staticAnalysis.ts` / `dynamicsAnalysis.ts` /
  `statusSummary.ts` — the solvers the adapter calls (read-only).
- `src/components/CoupledDynamicsPanel.tsx` — analysis-panel pattern.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 455 + new 8C tests).
- The baseline parameter vector reproduces current v1 results exactly.
- The optimizer reports feasibility explicitly; an infeasible problem is never
  returned as a valid design; failed/non-finite evaluations are rejected.
- No engineering math in the component (Rules 2/7); no existing
  `src/calculations/` solver modified; `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 8C DONE and 8D ACTIVE.
4. Single package-scoped commit.
