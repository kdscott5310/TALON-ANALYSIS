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
| M11 | Lateral / out-of-plane cable dynamics | 🔄 in progress | `milestone-11-lateral-cable` | — |
| M12 | Load combos, uncertainty, optimization | ⬜ not started | — | — |
| M13 | Component sizing, BOM, procurement | ⬜ not started | — | — |
| M14 | FMEA, hazards, review records | ⬜ not started | — | — |
| M15 | 3D + customer/operator visualization | ⬜ not started | — | — |
| M16 | Digital twin & test correlation | ⬜ not started | — | — |
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
