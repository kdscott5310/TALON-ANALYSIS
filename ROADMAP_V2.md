# TALON v2 Roadmap — Generalized Engineering Analysis Platform

Evolves TALON from the single-purpose CUFTS planner (v1.0.0, Milestones 1–5)
into a reusable analysis platform for cable-supported test fixtures, moving
trolley systems, crane-supported fixtures, and portable test structures.

**The CUFTS application remains a built-in project template.** No existing
scenario JSON breaks without an explicit, tested schema migration.

> All calculations in this platform are **preliminary engineering estimates**.
> Nothing here is a certified engineering result. See
> [SAFETY_LIMITATIONS.md](SAFETY_LIMITATIONS.md).

---

## Standing engineering rules (apply to every milestone)

1. Never describe preliminary calculations as certified engineering results.
2. Never silently substitute a missing rating with zero or an assumed safe
   value — missing is a distinct state that propagates to results.
3. Distinguish **verified / provisional / estimated / example / missing** data.
4. Every solver exposes assumptions, units, intermediate values, residuals,
   convergence status, and applicability limits.
5. Calculation kernels stay independent of React.
6. SI internally; conversion only at the display/input boundary.
7. Independent analytical benchmarks before a solver is called complete.
8. Deterministic calculations, reproducible analysis cases.
9. Never claim full FEA where a reduced-order or lumped-parameter model is
   implemented.
10. No single giant implementation commit; a passing build after each milestone.

---

## Baseline at start of v2 (main @ `e54e1fa`)

| Check | Result |
|---|---|
| `npm test` | 115 passing (8 suites) |
| `npm run build` | clean (TypeScript strict, Vite 5) |
| `npm audit` (production) | 0 vulnerabilities |
| `npm audit` (incl. dev) | **5 (1 critical, 1 high, 3 moderate)** — see Risk R-0 |

### Existing architecture

```
src/calculations/   solvers — parabolicCable, masterNode, anchorCheck,
                    staticAnalysis, trolleyPath, trolleyDynamics,
                    dynamicsAnalysis, statusSummary, benchmarks, layoutGeometry
src/models/         CUFTS Scenario (schema v3) + example + serialization
src/units/          SI-internal unit system + display formatters
src/validation/     input validation (blocking errors + advisory warnings)
src/state/          Zustand store, memoized solver hooks
src/reports/        report data assembly, CSV export
src/components/     React UI (panels, views, charts, error boundary)
src/tests/          8 Vitest suites
```

---

## Milestone dependency graph

```
M6 Generalized model  ──┬── M7 Nonlinear cable ──┬── M8 Coupled dynamics
    (foundation)        │                        │
                        ├── M9 Component library ┤
                        │                        │
                        ├── M10 Brake + optimize ┘
                        │
                        ├── M11 3D visualization   (consumes M6 model + results)
                        ├── M12 FMEA / risk        (independent of solvers)
                        └── M13 Digital twin       (needs M7/M8 for calibration)
```

- **M6 blocks everything** — it is the data foundation.
- **M7 → M8**: coupled dynamics needs the nonlinear cable formulation.
- **M10** benefits from M9 (component-sourced brake data) but can proceed with
  user-entered curves.
- **M11/M12** are largely parallel once M6 lands.
- **M13** requires M7/M8 to have parameters worth calibrating.

---

## Milestone 6 — Generalized model architecture

**Goal.** A reusable project model that can describe cable/trolley/crane
systems generically, with CUFTS preserved as a template.

**Scope.** projects, templates, nodes, coordinate systems, elements, materials,
components, supports, constraints, loads, load cases, moving bodies, analysis
cases, solver results, verification metadata. Element types: cable, truss,
rigid link, linear spring, viscous damper, point mass, brake/contact force.

**Approach.** Additive model layer (`src/core/`). Existing solvers remain
**unchanged** and are reached through an adapter that extracts the CUFTS
`Scenario` from a `Project`. This guarantees bit-identical results while the
generalized representation is established alongside.

**Acceptance criteria.**
- Generalized types compile under strict TypeScript with no `any` in public API.
- CUFTS template builds a `Project` from a `Scenario` with correct node/element
  topology.
- `Project → Scenario` adapter round-trips losslessly.
- Migration from Scenario schema v1/v2/v3 files into a `Project`.
- Missing quantities are representable and never coerced to 0.

**Test requirements.**
- Existing example scenarios produce **identical** static and dynamic results
  before and after migration (exact equality on key outputs).
- Round-trip `Scenario → Project → Scenario` deep-equals the original.
- Migration of legacy files produces disclosed notes, never silent defaults.
- Element/node referential integrity validation.
- All 115 pre-existing tests continue to pass.

**Risks.** R-1, R-2 (below).

---

## Milestone 7 — Nonlinear elastic cable analysis

**Goal.** Selectable parabolic / elastic catenary / segmented nonlinear cable
models with a real iterative equilibrium+compatibility solution.

**Scope.** Unstretched length, axial stiffness EA, self-weight, pretension,
concentrated moving load, temperature strain, creep/constructional stretch,
support elevation and movement, trolley position.

**Reported.** Convergence status, iteration count, force residual,
displacement/length residual, cable profile, axial strain, tension
distribution, support reactions, trolley reactions, ground clearance, and an
explicit comparison against the parabolic model.

**Acceptance criteria.**
- Catenary reduces to the parabolic result in the small-sag limit within a
  documented tolerance.
- Segmented model converges to the catenary as element count increases.
- Non-convergence is reported as a first-class failure, never a silent result.

**Test requirements.**
- Hand-calculable benchmarks (level-support catenary, known sag/tension).
- Literature-based benchmarks with cited closed-form values.
- Failure tests: infeasible geometry, slack cable, invalid EA, impossible cable
  length (shorter than chord), non-convergence.
- Determinism and mesh-refinement convergence tests.

**Risks.** R-3.

---

## Milestone 8 — Coupled dynamics

**Goal.** Reduced-order coupled trolley/cable/payload dynamics.

**Scope.**
- Wheel rotational inertia via effective-mass formulation, plus optional
  explicit wheel states.
- Damped payload pendulum with longitudinal and lateral motion driven by
  trolley acceleration, braking, and wind.
- Advanced preliminary **3D lumped-mass cable model**: distributed cable mass,
  geometric stiffness, axial tension, lateral+vertical displacement, moving
  trolley mass, payload pendulum, aerodynamic wind/gust, damping, support
  motion, brake input.

**Reported time histories.** Trolley position/speed/acceleration, wheel speed,
cable tension, cable lateral displacement, payload pitch and sway, payload
clearance envelope, crane hook force components, out-of-plane reaction, brake
force and energy.

**Labeling.** The advanced model is labeled **reduced-order nonlinear dynamics
requiring specialized validation** everywhere it appears (UI, reports, exports).

**Acceptance criteria.**
- Energy accounting closes within a stated tolerance for all models.
- Effective-mass wheel model reduces to the M3 point-mass result when inertia
  is zero.
- Pendulum reduces to the analytical small-angle period.

**Test requirements.** Analytical pendulum period, energy conservation,
zero-inertia reduction, time-step sensitivity, stability limits, determinism.

**Risks.** R-3, R-4.

---

## Milestone 9 — Component and material library

**Goal.** A versioned local library for cable, rigging, trolley, brake, crane,
anchor, structural, and instrumentation components.

**Every engineering property carries.** value, units, source,
manufacturer/model, revision/date, verification state, confidence, derating,
notes.

**Hard rule.** No vendor data hard-coded as certified. Seeded records are
clearly marked examples requiring user verification.

**Acceptance criteria.** JSON and CSV import/export; library revisioning;
property provenance surfaced in reports; example records visibly flagged.

**Test requirements.** Import validation and rejection paths, round-trip
export/import, provenance preservation, derating application, and a test that
no seeded record claims `verified`.

**Risks.** R-5.

---

## Milestone 10 — Brake curves and optimization

**Goal.** Rich brake force models plus constrained design optimization.

**Brake models.** Constant force, linear ramp, velocity-proportional,
position–force table, velocity–force table, time–force table, imported measured
CSV curve, hydraulic cylinder/orifice model, accumulator model, shock-absorber
curve, eddy-current force–speed–gap model. Safe interpolation with **explicit
extrapolation warnings**.

**Optimization variables.** Pretension, cable diameter, brake engagement
location, brake-force parameters, anchor/ballast mass, target terminal speed,
stopping distance, maximum acceleration/deceleration, safety-factor
constraints.

**Reported.** Feasibility, controlling constraints, sensitivities, optimization
history.

**Hard rule.** Never return an apparently valid design when constraints are
infeasible — infeasibility is an explicit, prominent result.

**Test requirements.** Interpolation correctness and extrapolation warnings,
each brake model against analytical/energy checks, optimizer convergence on
problems with known optima, and infeasible-problem detection.

**Risks.** R-6.

---

## Milestone 11 — 3D visualization

**Goal.** Three.js / React Three Fiber rendering of terrain, crane, hook/master
node, anchors, cable, trolley, suspended payload, brake, load vectors,
clearance and sway envelopes, and undeformed/deformed geometry.

**Interaction.** Side/front/top/isometric views, orbit/pan/zoom, result
animation, deflection scale, load-case selector, image export.

**Hard rule.** The 3D layer **only visualizes** model and solver data. No
engineering calculation may live in rendering components (Rule 5).

**Acceptance criteria.** Renders from the M6 model + solver results with no
duplicated math; performance acceptable for typical models.

**Test requirements.** Geometry-mapping unit tests (model → scene coordinates)
that run without a GPU; a lint/architecture test asserting no solver imports in
rendering components.

**Risks.** R-7.

---

## Milestone 12 — FMEA and risk

**Goal.** Integrated FMEA and hazard register: severity, occurrence, detection,
RPN, mitigations, owners, evidence, closure status.

**Seeding.** Relevant failure modes seeded but clearly labeled starter content
requiring engineering review.

**Integration.** Open critical risks appear in the engineering report and the
status summary.

**Test requirements.** RPN computation, closure-state transitions, and a test
that open critical risks propagate into report data and overall status.

**Risks.** R-5.

---

## Milestone 13 — Digital twin

**Goal.** Import measured test data and calibrate the model against it.

**Scope.** CSV import with channel mapping for time, position, velocity,
acceleration, tension, crane load, brake force, payload angle, wind. Units and
scaling, zero correction, filtering, time alignment, simulation overlay,
residual plots, RMSE / peak error / timing error, parameter estimation,
calibrated scenario copies, test metadata, calibration revision history.

**Initial estimable parameters.** Rolling resistance, aerodynamic drag
coefficient, cable damping, payload damping, effective cable stiffness,
brake-force scale, bearing resistance.

**Hard rule.** A calibrated model is still a preliminary model; calibration
never upgrades results to "certified", and calibrated copies are marked as
derived from specific test data.

**Test requirements.** Error-metric correctness against known signals, filter
and alignment correctness, parameter recovery on synthetic data with known
parameters, and provenance of calibrated copies.

**Risks.** R-4, R-8.

---

## Future FEA path (design for, do not build now)

The generalized model is designed so it can later support: 2D truss, 2D frame,
3D truss, nonlinear cable/truss, modal analysis, transient structural analysis,
and export to an external validated FEA solver.

**Explicitly out of scope for the first implementation** and documented as
future external-solver integrations: shell elements, solid elements, automatic
meshing, nonlinear contact, and plasticity. TALON will not claim FEA
capabilities it does not implement (Rule 9).

Enabling design choices made in M6: node/element topology with explicit
coordinate systems, DOF-oriented supports and constraints, load cases separated
from loads, and solver results carried as versioned records with residuals —
all of which map onto a standard FE data model.

---

## Risk register

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| **R-0** | Dev toolchain has 5 known advisories (Vitest critical CVSS 9.8 — arbitrary file read/exec when the Vitest **UI** server listens; Vite high CVSS 7.5 — `server.fs.deny` bypass on Windows; esbuild moderate — any site can read dev-server responses). Production bundle is **unaffected** (prod audit = 0). An unattributed `audit fix --force` previously bumped Vite 5→8 / Vitest 2→4 and was reverted to keep the v1.0.0 release on its validated stack. | Dev-machine exposure only; blocks a clean `npm audit` | Treat as its **own** branch/milestone, not bundled into feature work: deliberately upgrade Vite/Vitest majors, fix deprecations, re-run the full suite + benchmarks. Until then: do not run `vitest --ui`, and do not expose the dev server on untrusted networks. |
| **R-1** | Generalized model diverges from CUFTS behavior, silently changing results | Loss of v1 validation | Adapter keeps existing solvers byte-identical; equality tests on migrated scenarios |
| **R-2** | Schema churn breaks saved user scenarios | Data loss | Versioned envelopes + explicit migrations + disclosed migration notes; never silent defaults |
| **R-3** | Nonlinear solvers fail to converge on realistic inputs | Unusable results | Convergence status as a first-class output; failure tests; parabolic fallback comparison always shown |
| **R-4** | Reduced-order dynamics mistaken for validated FEA/multibody | **Safety** | Persistent labeling in UI/reports/exports; Rule 9 enforced in copy review |
| **R-5** | Seeded library/FMEA content mistaken for certified or complete | **Safety** | All seeds marked `example`; tests assert no seed claims `verified` |
| **R-6** | Optimizer returns a design that violates constraints | **Safety** | Explicit feasibility flag + controlling-constraint reporting; infeasible ≠ best-effort answer |
| **R-7** | Calculations creep into rendering components | Architecture erosion | Architecture test forbidding solver imports in 3D components |
| **R-8** | Calibration overfits and inflates confidence | Misleading results | Report residuals + error metrics; mark calibrated copies with provenance and source test |

---

## Milestone completion checklist (every milestone)

- [ ] `npm test` passes (including all prior suites)
- [ ] `npm run build` passes
- [ ] `npm audit` reviewed and status recorded
- [ ] Independent analytical benchmarks added for new solvers
- [ ] Assumptions, residuals, convergence, and applicability limits exposed
- [ ] `TASKLIST.md`, `TRACEABILITY.md`, `PROJECT_SPEC.md`, `VALIDATION.md`,
      `SAFETY_LIMITATIONS.md`, `CHANGELOG.md`, `RELEASE_NOTES.md` updated
- [ ] Logical checkpoint commits on the milestone branch; `main` untouched
