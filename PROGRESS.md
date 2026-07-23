# TALON v2 — Milestone Progress Tracker

Live status of the 17-milestone platform roadmap. Updated as each milestone
lands. See [ROADMAP_V2.md](ROADMAP_V2.md) for full scope and acceptance
criteria.

**Baseline:** `main` @ `e54e1fa` — v1.1.0, Milestones 1–5, 115 tests.

---

## Status board

| MS | Title | Status | Branch | Tests |
|---|---|---|---|---|
| M6 | Generalized platform model | ✅ **COMPLETE** | `milestone-6-generalized-platform` | 186 |
| M7 | Data provenance & component library | ✅ **COMPLETE** | `milestone-7-component-library` | 213 |
| M8 | Nonlinear elastic cable analysis | ✅ **COMPLETE** | `milestone-8-nonlinear-cable` | 228 |
| M9 | Wheel inertia, trolley dynamics, pendulum | ✅ **COMPLETE** | `milestone-9-coupled-dynamics` | 243 |
| M10 | Brake curve modeling | ✅ **COMPLETE** | `milestone-10-brake-curves` | 263 |
| M11 | Lateral / out-of-plane cable dynamics | ✅ **COMPLETE** | `milestone-11-lateral-cable` | 273 |
| M12 | Load combos, uncertainty, optimization | ✅ **COMPLETE** | `milestone-12-uncertainty-optim` | 286 |
| M13 | Component sizing, BOM, procurement | ✅ **COMPLETE** | `milestone-13-sizing-bom` | 297 |
| M14 | FMEA, hazards, review records | ✅ **COMPLETE** | `milestone-14-fmea` | 307 |
| M15 | 3D + customer/operator visualization | ⬜ not started (needs browser session) | — | — |
| M16 | Digital twin & test correlation | ✅ **COMPLETE** | `milestone-16-digital-twin` | 317 |
| M17 | Truss/frame groundwork, external FEA | ⬜ not started | — | — |

---

## M6 — Generalized platform model ✅

**Branch:** `milestone-6-generalized-platform` (pushed)
**Commits:** `477d130`, `24b4da4`, `94dd043`, `67bb3d9`, `78271f9`
**Tests:** 186 passing · **Build:** clean · **Audit:** 5 dev-only (accepted, R-0)

Delivered:
- `core/dimensions.ts` — 24 dimensions, SI units, runtime dimensional algebra
- `core/coordinates.ts` — 8 frame kinds, rotations, frame-tagged vectors
- `core/provenance.ts` — 10 verification states, derating preserves source value
- `core/solver.ts` — fidelity Levels 0–3, applicability engine, acceptance rule, Not-certified badge
- `core/analysisRun.ts` — frozen, fingerprinted, reproducible runs
- `core/elements.ts` — 14 element types + 4 future export-only types
- `core/model.ts` — full Project aggregate + integrity checking
- `core/templates/registry.ts` — 13 templates, only CUFTS implemented (others throw)
- `core/templates/cufts.ts` — CUFTS as first fixture template, v1 results unchanged
- `core/projectSerialization.ts` — migration from scenario schema v1/v2/v3

**Not done (deferred by design):** UI adoption of the project model; result
badges rendered in panels (M15).

---

## M7 — Data provenance & component library ✅

**Branch:** `milestone-7-component-library` · **Tests:** 213 · **Build:** clean

- `core/library/componentLibrary.ts` — versioned library, record/property provenance, obsolescence, merge rules, audit warnings
- `core/library/libraryIo.ts` — JSON round-trip + CSV import/export (CSV can never assert verification)
- `core/library/sourceAdapters.ts` — online-retrieval adapter contract with compliance gating; search snippets refused as proof; no network adapter ships in this build
- `core/library/seedLibrary.ts` — 6 example-only records carrying no manufacturer/model/part number

**Key guarantees tested:** verified records are never overwritten by unverified
data; seeds never claim verification; CSV imports enter as importedUnverified;
empty CSV values become MISSING, not zero; adapters that bypass access controls
are refused.

**Not done:** UI for browsing/editing the library (deferred with other UI work).

## M8 — Nonlinear elastic cable analysis ✅

**Branch:** `milestone-8-nonlinear-cable` · **Tests:** 228 · **Build:** clean · **Fidelity: Level 2**

- `calculations/elasticCatenary.ts` — exact elastic-catenary equations (Irvine 1981) solved by Newton iteration with an analytic Jacobian on the end-force components (H, V)
- Accounts for unstretched length, EA, self-weight, support elevation, temperature strain, and creep (as an effective-length change)
- Reports convergence status, iteration count, force/geometry residuals, tension & strain distribution, support reactions, elongation, sag, lowest point, and a parabolic comparison
- Registered as the first **Level 2** solver (`cable-elastic-catenary`), reduced-order
- 15 benchmark/failure tests: catenary→parabolic reduction in the small-sag limit, H = wL²/8d, elastic elongation T·L/EA, temperature effect, sloped-span tensions, mesh-independent forces; plus failure tests for invalid EA, too-short cable, bad geometry, deep sag, and slack detection

**Fixed during M8:** the committed solver bowed the profile upward (maxSag
always 0); corrected the vertical sign convention consistently in the z-closure
residual and profile so the cable sags physically.

**Not done (honestly deferred):** segmented nonlinear multi-element cable model
and moving-load geometric stiffening — the catenary covers the core M8
requirement; segmented discretization is follow-on work. UI selection of cable
model deferred with other UI work.

## M9 — Wheel inertia & payload pendulum ✅

**Branch:** `milestone-9-coupled-dynamics` · **Tests:** 243 · **Build:** clean · **Fidelity: Level 2**

- `calculations/wheelDynamics.ts` — wheel rotational inertia via effective-mass m_eff = m + I/r²; direct entry or geometry estimate (I = k·m·r², k reported); rotational energy and wheel angular speed. Zero inertia reduces EXACTLY to the M3 point mass.
- `calculations/payloadPendulum.ts` — RK4 damped pendulum, longitudinal (trolley accel/brake) + lateral (crosswind/gust drag); reports peak angles, displacement envelope, attachment reaction, natural period, settling time, ground-clearance rise, and swing-limit warnings.
- 20 benchmark tests: zero-inertia reduction, m_eff and disc-inertia formulas, small-angle period T=2π√(L/g), damped-vs-undamped settling, accel→pitch / wind→sway decoupling, hard-brake large-swing warning path, determinism, invalid-input rejection.

**Not done (honestly deferred):** wheel slip/bearing-loss sub-model and full
coupling of the pendulum reaction back into the trolley/cable (that coupling is
the M11 reduced-order 3D cable model). UI wiring deferred.

## M10 — Brake curve modeling ✅

**Branch:** `milestone-10-brake-curves` · **Tests:** 263 · **Build:** clean

- `calculations/brakeCurves.ts` — displacement/velocity/time-force tables, force-stroke curve, and measured CSV import; linear interpolation that CLAMPS at the endpoints and flags extrapolation (never silently extrapolates); hydraulic cylinder+orifice model (F ∝ v²), eddy-current force-speed-gap model (peak + 1/gap²)
- Original imported samples and raw CSV text preserved separately (Rule 5); warnings for extrapolation, negative force, discontinuities, and force beyond rating
- 24 tests: exact interpolation, clamp-not-extrapolate, per-axis selection, hydraulic v² law, eddy 1/gap² scaling, CSV parse/sort/reject

**Not done (honestly deferred):** accumulator/relief transient dynamics,
brake-fade thermal model, and wiring the curves into the trolley dynamics run
(the M3 solver still uses the idealized laws until UI selection is added).

## M11 — Lateral / out-of-plane cable dynamics ✅

**Branch:** `milestone-11-lateral-cable` · **Tests:** 273 · **Build:** clean · **Fidelity: Level 2 (reduced-order)**

- `calculations/lateralCableDynamics.ts` — lumped-mass tensioned-string model for out-of-plane sway: distributed mass, geometric stiffness from axial tension, damping, distributed wind/gust, moving trolley mass, lateral brake impulse
- Reports fundamental frequency, peak lateral displacement, static wind deflection, dynamic amplification, peak out-of-plane support reaction (crane side-load), dominant response frequency, envelope; CFL-stable explicit integration
- **Analytical benchmark:** discrete model matches the continuous string fundamental f=(1/2L)√(T/μ) to <0.1% and converges with node count; static wind deflection matches q·L²/(8T)
- 10 tests; persistently labeled reduced-order (not FEA)

**Not done (honestly deferred):** full 3-DOF (vertical + axial) coupling — this
solves the transverse mode with axial tension held static; full multibody
coupling is beyond the reduced-order scope. UI wiring deferred.

## M12 — Uncertainty, sensitivity & optimization ✅

**Branch:** `milestone-12-uncertainty-optim` · **Tests:** 286 · **Build:** clean

- `calculations/sensitivity.ts` — one-at-a-time sensitivity with tornado ordering, worst/best-case combinations, parameter sweeps, and 3-point probability-of-exceedance that always returns the full distribution behind the number
- `calculations/optimization.ts` — bounded constrained optimizer (coordinate descent + golden-section) with explicit feasibility flag, controlling (most-violated) constraints, search history, and local sensitivity. NEVER returns a valid-looking design when infeasible; never selects a non-finite (failed-solve) point
- 13 tests against analytical optima: convex 1-D/2-D minima, active-constraint bound, infeasible-problem detection, failed-solve rejection, tornado order, exceedance probability

**Load combinations:** the data model (M6) already carries user-defined
combinations with no assumed code factors. **Not done:** Monte Carlo sampling
(3-point grid only) and wiring the optimizer to the CUFTS objective — deferred.

## M13 — Component sizing, BOM & procurement ✅

**Branch:** `milestone-13-sizing-bom` · **Tests:** 297 · **Build:** clean

- `calculations/componentSizing.ts` — required rating = demand × design factor; deratings reduce the published rating (kept separate, Rule 5); ranks all candidates by margin without auto-picking the smallest; excludes obsolete/unverified when verified data required; missing rating → insufficient information (never adequate)
- `reports/procurementSheet.ts` — search-phrase generator, RFQ text, and CSV that distinguishes calculated requirement / recommended minimum / selected / verified and marks unselected demands PROCUREMENT REQUIRED
- BOM assembly turns a no-candidate demand into a procurement line, never a fabricated part
- 15 tests covering rating math, deratings, ranking, exclusions, missing-rating, BOM, and search-sheet honesty

**Not done:** UI for the BOM/procurement panels and cost roll-up — deferred with other UI work.

## M14 — FMEA & hazard register ✅

**Branch:** `milestone-14-fmea` · **Tests:** 307 · **Build:** clean

- `core/fmea.ts` — FMEA entries (S/O/D, RPN, mitigation, owner, evidence, closure status); criticality banding where a catastrophic-severity mode is never downgraded below high regardless of RPN; open critical/high risks propagate to feed the acceptance decision (Rule 2)
- 25 seeded starter failure modes (cable rupture, brake failure, anchor sliding, crane side load, derailment, overspeed, zone intrusion, invalid hardware data, solver non-convergence, …), every one labeled `starterContent` and open
- 12 tests: RPN math, criticality banding + severity override, open-risk propagation, status transitions, priority ordering, and the seed-labeling guarantee

**Not done:** UI hazard-register panel and wiring open-critical risks into the
live report/status badge (the engine exposes `openCriticalOrHighRisks` ready
for that binding). Deferred with other UI work.

## M16 — Digital twin / test-data correlation ✅

**Branch:** `milestone-16-digital-twin` · **Tests:** 317 · **Build:** clean

- `calculations/testCorrelation.ts` — measured-channel model (raw NEVER mutated); non-destructive conditioning (scale/polarity/zero), moving-average filtering; predicted-vs-measured correlation with RMSE, peak error, peak-value error, timing error via best time-shift alignment, integral/energy error, and R²; residual signal
- Parameter estimation by RMSE minimization (coordinate descent + golden section) that recovers a known parameter from synthetic data and flags unidentifiable parameters the data cannot constrain
- 12 tests: raw-preservation, metric correctness on identical/shifted/scaled signals, offset recovery, slope recovery, identifiability warning, determinism

**Not done:** UI overlay/residual plots and calibrated-scenario-copy persistence
(the copy would be marked derived-from-test and still preliminary). Deferred with
other UI work.

## Known carry-forward items

| ID | Item | Owner milestone |
|---|---|---|
| R-0 | Dev toolchain: 5 advisories (Vitest critical, Vite high) — prod bundle unaffected (`--omit=dev` = 0). Accepted exception; needs its own upgrade branch. | separate |
| — | Cable EA, unstretched length, creep, thermal expansion are `missing` in migrated v1 projects — M8 solvers need real values or must report insufficient information | M8 |
| — | Wheel rotary inertia, wheel radius/count, payload damping are `missing` | M9 |
| — | Brake energy capacity is `missing` | M10 |
| — | Run fingerprint is FNV-1a change-detection, **not** cryptographic tamper-proofing | future |

---

## How to reference this work

Each milestone lives on its own branch, pushed to
`github.com/kdscott5310/TALON-ANALYSIS`. `main` is untouched at the v1.1.0
release. To review a milestone:

```bash
git fetch --all
git log --oneline main..milestone-6-generalized-platform
git diff main..milestone-6-generalized-platform --stat
```
