# TALON v2 Roadmap — Engineering Analysis & Fixture-Planning Platform

Evolves TALON from the single-purpose CUFTS planner (v1.x, Milestones 1–5)
into a reusable platform for engineering analysis, visualization, fixture
planning, hardware selection, and test-data correlation.

Target system types: cable-supported fixtures, crane-supported systems, moving
trolley systems, suspended payloads, drop fixtures, rail fixtures,
tower-supported systems, tow systems, sensor and seeker test fixtures, UAS test
systems, and other mechanical test arrangements.

**The CUFTS configuration remains a built-in fixture template and continues to
produce the same validated results** unless a user intentionally selects a
higher-fidelity solver.

> TALON is an engineering planning and analysis platform. It never replaces
> licensed engineering review, crane-company approval, certified load charts,
> rigging approval, structural certification, range-safety approval, or
> manufacturer data. See [SAFETY_LIMITATIONS.md](SAFETY_LIMITATIONS.md).

---

## Engineering governance (applies to every milestone)

1. Never describe preliminary analysis as certified or approved.
2. Never mark a result acceptable when required data is missing, a solver
   failed, a model is outside its applicability range, a critical property is
   unverified, a required rating is unknown, a calculated load exceeds a
   rating, or a critical risk is unresolved.
3. Never silently replace missing values with zero.
4. Never silently use example or estimated manufacturer properties as verified.
5. Preserve the original source value separately from any engineering derating.
6. Every calculated result identifies solver, solver version, fidelity level,
   units, coordinate system, assumptions, input sources, verification status,
   convergence status, applicability status, and unresolved limitations.
7. Engineering calculations stay independent of React components.
8. SI internally; convert only at defined interfaces.
9. Deterministic, reproducible results.
10. Analytical benchmarks before a solver is declared complete.
11. Clearly distinguish reduced-order dynamics from full finite-element analysis.
12. Never use online product data as certified without user verification.

---

## Analysis fidelity levels

Every analysis carries a visible level. TALON must not claim Level 3 unless an
external solver result has actually been imported and identified.

| Level | Name | Content |
|---|---|---|
| **0** | Screening | Conservative hand calculations, closed-form feasibility checks: load totals, cable screening, minimum anchor weight, average brake force, basic trajectory, simple utilization |
| **1** | Preliminary design | Simplified models: parabolic cable, rigid-body trolley, idealized braking, simplified pendulum, static crane resultant, basic fixture reactions |
| **2** | Advanced preliminary | Numerical/coupled: elastic catenary, segmented nonlinear cable, moving-load equilibrium, wheel inertia, coupled trolley/payload dynamics, lateral cable motion, imported brake curves, uncertainty and optimization |
| **3** | External validated | Prepared/exported/imported/correlated with a validated external solver (CalculiX, OpenSees, Code_Aster, MOOSE, Abaqus/ANSYS-compatible export where legally and technically practical) |

Every result panel and report shows a badge:

```
Analysis level:       Level 2 — Advanced Preliminary
Solver:               Segmented nonlinear cable
Validation:           Benchmark verified
Input confidence:     Mixed
Applicability:        Within limits
Certification status: Not certified
```

**Current TALON v1 solvers are Level 1** (parabolic cable, rigid-body trolley,
idealized braking). No Level 2 or 3 result exists until M8+.

---

## Milestone dependency graph

```
M6  Generalized platform model ──┬─ M7  Component library ──┬─ M13 Sizing/BOM/procurement
    (dimensional types,          │    (provenance, sources) │
     coordinate systems,         │                          │
     templates, migration,       ├─ M8  Nonlinear cable ─┬── M11 Lateral/out-of-plane dynamics
     solver interfaces,          │                       │
     immutable runs)             │                       ├─ M9  Wheel inertia + pendulum
                                 │                       │
                                 ├─ M10 Brake curves ────┘
                                 │
                                 ├─ M12 Load combos, uncertainty, optimization
                                 ├─ M14 FMEA / hazards / review records
                                 ├─ M15 3D + customer/operator visualization
                                 ├─ M16 Digital twin / correlation
                                 └─ M17 Truss/frame groundwork + external FEA
```

- **M6 blocks everything** — it is the data and contract foundation.
- **M13** needs M7 (component data) and M12 (demands from load combinations).
- **M11** needs M8 (nonlinear cable) and M9 (payload dynamics).
- **M15/M16** consume solver results; they add no engineering math.
- **M17** is groundwork only — no solid/shell FEA.

---

## MILESTONE 6 — Generalized platform model

Generalized project model, dimensional types, coordinate systems, templates,
schema migration, solver interfaces, immutable analysis-run design.

**Scope.** Project entities (identity, customer, test program, template, site,
geometry, coordinate systems, materials, components, nodes, elements, supports,
constraints, loads, load cases, load combinations, moving bodies, analysis
cases, analysis runs, risks, assumptions, test data, reports, BOM, revisions,
review status); dimension-tagged quantities; eight coordinate-system kinds;
fixture-template registry; solver interface with fidelity/applicability;
immutable analysis runs; migration from the v1 CUFTS scenario schema.

**Acceptance criteria.**
- Dimensional types prevent mixing incompatible quantities at compile time.
- Every vector result states its coordinate system.
- Solver contract carries solver id, version, fidelity, assumptions,
  convergence, applicability, and limitations.
- Analysis runs are frozen and reproducible.
- CUFTS is the first fixture template and its results are unchanged.
- Missing data is representable and never coerced to zero.

**Test requirements.** Exact-equality regression of CUFTS static/dynamic/summary
results after migration; round-trip serialization; dimensional-consistency
tests; immutability tests; template-registry honesty (unimplemented templates
cannot be instantiated); provenance rules.

**Risks.** R-1, R-2.

---

## MILESTONE 7 — Data provenance and component library

Component/material library, source attachments, verification states, library
import/export, initial component adapters.

**Categories.** Wire rope, synthetic rope, cable, chain, shackles, master links,
delta rings, turnbuckles, load cells, dynamometers, sheaves, snatch blocks,
pulleys, bearings, wheels, trolley frames, brakes, hydraulic cylinders,
accumulators, shock absorbers, winches, cranes, portable masts, ecology blocks,
ballast, ground anchors, structural steel, aluminum, fasteners, sensors,
cameras, encoders, DAQ, controllers, safety devices.

**Every property carries.** Name, value, units, source type, source document,
source URL, manufacturer, model, part number, source page/table, revision,
publication date, retrieval date, applicable temperature / loading direction /
speed / duty cycle, derating rule, verification status, confidence, entered by,
verified by, verification date, notes.

**Verification states.** Manufacturer verified, supplier listed, user verified,
internally tested, estimated, example only, imported unverified, obsolete,
missing.

**Online retrieval (adapter architecture only in M7).** Online data is marked
*imported unverified*; URL and retrieval date preserved; search snippets are
never engineering proof; users must verify critical ratings against the current
manufacturer document; a verified record is never overwritten by an unverified
one; source history maintained; no scraping in violation of terms or access
controls; manufacturer documents preferred over distributor summaries. Users may
attach a PDF/data sheet and cite the page supporting each critical property.

**Acceptance criteria.** No vendor data hard-coded as certified; seeded records
visibly example-only; derating never overwrites the original source value.

**Risks.** R-5, R-9.

---

## MILESTONE 8 — Nonlinear elastic cable analysis

Elastic catenary, segmented nonlinear cable, moving-load geometric stiffening,
solver residuals, mesh convergence. **Fidelity Level 2.**

**Accounts for.** Unstretched length, EA, pretension, self-weight, concentrated
trolley load, distributed payload, support elevation and movement, temperature
strain, constructional stretch, creep, material nonlinear approximation where
appropriate, trolley location, wind, out-of-plane loading.

**Reports.** Iteration count, convergence status, force residual, compatibility
residual, displacement residual, cable profile, lowest point, tension
distribution, strain distribution, support reactions, trolley reaction, crane
hook resultant, anchor reaction, clearance, and comparison against the
parabolic result.

**Handles.** Slack cable, impossible cable length, invalid EA, invalid
pretension, excessive strain, non-convergence, support coincidence,
near-vertical geometry, inappropriate discretization.

**Test requirements.** Hand-calculable and literature benchmarks; catenary →
parabolic reduction in the small-sag limit; segmented → catenary convergence
with refinement; mesh-convergence and solver-sensitivity studies; all failure
modes tested.

**Risks.** R-3.

---

## MILESTONE 9 — Wheel inertia, trolley dynamics, payload pendulum

**Wheel rotational inertia.** Wheel mass, diameter, inertia, count, rotational
speed, bearing losses, slip, rolling contact, rotational energy, speed limit.
Direct inertia entry or geometry-based estimation.

**Payload pendulum.** Longitudinal and lateral damped modes. Inputs: payload
mass, suspension length, CG, initial angle, damping, trolley acceleration,
braking deceleration, wind, payload drag, payload inertia. Outputs:
longitudinal pitch, lateral sway, displacement envelope, attachment reaction,
peak angle, settling time, ground-clearance envelope, collision warning,
brake-induced swing.

**Acceptance criteria.** Zero-inertia reduces exactly to the M3 point-mass
result; pendulum matches the analytical small-angle period.

**Risks.** R-4.

---

## MILESTONE 10 — Brake modeling

Retain existing idealized models and add: displacement/velocity/time–force
tables, force–stroke curve, imported measured CSV, hydraulic cylinder, orifice,
accumulator, shock absorber, friction brake, cable-drum brake, eddy-current
force–speed–gap, motor/regenerative, backup arrestor.

Store original imported data and interpolation settings separately.

**Warns about.** Extrapolation, missing regions, negative force,
discontinuities, stroke exceedance, velocity outside curve, force beyond
rating, heat capacity, reset time, brake fade, backup-arrestor engagement,
anchor overload.

**Risks.** R-6.

---

## MILESTONE 11 — Lateral and out-of-plane cable dynamics

Advanced preliminary lumped-mass model: distributed cable mass, three
translational DOF per cable node, axial tension, geometric stiffness, damping,
wind and gust, moving trolley mass, suspended payload, support movement, brake
impulse, crane hook motion where entered.

**Outputs.** Lateral and vertical displacement, tension vs. time, out-of-plane
support reaction, crane side-load estimate, payload sway, clearance volume,
dominant frequency estimate, dynamic amplification.

**Labeling.** Persistently labeled **reduced-order nonlinear dynamics**, never
finite-element analysis (Rule 11).

**Risks.** R-4.

---

## MILESTONE 12 — Load combinations, uncertainty, sensitivity, optimization

**Load cases.** Dead, pretension, launch, trolley at position, normal
operation, brake entry, maximum braking, emergency stop, backup arrestor,
steady wind, gust, crosswind, support movement, anchor degradation, component
failure, crane lowering, setup, recovery, transportation. User-defined
combinations and project factors; **no hard-coded building-code combinations**
unless a specific standard and revision are explicitly selected.

**Uncertainty.** Low/nominal/high for cable stiffness and mass, pretension,
payload mass, rolling resistance, bearing drag, drag coefficient, ground
friction, brake-force scale, wind, anchor weight, damping. One-at-a-time
sensitivity, tornado charts, worst-case combinations, parameter sweeps,
design-margin sensitivity, Monte Carlo later, confidence intervals, probability
of limit exceedance. Probabilistic conclusions always shown with distributions
and assumptions.

**Optimization.** Bounded and constrained over pretension, cable size/material,
brake location and parameters, stopping distance, max speed, anchor mass,
ballast count, component choice, wheel size, suspension length, fixture
geometry. The optimizer rejects invalid geometry, solver failure, and
non-convergence; identifies infeasible problems; reports controlling
constraints, search history, and local sensitivity; and preserves every
candidate's evaluation reason.

**Risks.** R-6, R-8.

---

## MILESTONE 13 — Component sizing, BOM, procurement

**Selection engine.** Maps calculated demands (tension, dynamic amplified
tension, side load, hook resultant, anchor reaction, brake force, energy,
stroke, trolley/wheel load, wheel speed, cable diameter, sheave D:d,
temperature, environment, cycles, geometry/weight/envelope limits) to candidate
hardware via required rating → design factor → orientation/use derating →
dynamic derating → environmental derating → dimensional and connection
compatibility → travel/stroke/speed/energy limits → source confidence →
exclusion of obsolete or unverified parts when verified data is required.

**Output per candidate.** Manufacturer, model, part number, demand, published
rating, derated rating, utilization, controlling criterion, compatibility,
verification status, source, cost, mass, availability, notes. Rankings may
weigh margin, weight, cost, availability, source quality, compatibility,
portability, lead time, reusability. **Never auto-select the smallest passing
component without showing alternatives and assumptions.**

**BOM + procurement search sheet.** Full BOM fields; a search sheet when no
exact component is selected; exports to CSV, XLSX-compatible CSV, printable
PDF, JSON, supplier inquiry text, and RFQ summary. Output distinguishes
**calculated requirement / recommended minimum / selected component / verified
component**.

**Risks.** R-5, R-9.

---

## MILESTONE 14 — FMEA, hazards, review records

Integrated FMEA and hazard register: subsystem, component, function, failure
mode, cause, local and system effect, detection method, existing control,
severity, occurrence, detection, RPN, mitigation, owner, due date, evidence,
status.

Starter modes (clearly labeled starter content): cable rupture, splice and
termination failure, shackle and master-ring failure, anchor sliding and
uplift, crane overload and side load, trolley derailment, wheel seizure and
overspeed, payload collision, excessive sway, brake failure and overheating,
backup-arrestor failure, unexpected release, winch runaway, power loss, sensor
failure, incorrect calibration, invalid hardware data, solver non-convergence,
excessive wind, operator-zone intrusion.

Reports include unresolved high-risk items. Customer/operator displays show
operational limits but **never imply approval to conduct a test**.

**Risks.** R-5.

---

## MILESTONE 15 — Visualization (engineering + customer/operator, 3D)

**Engineering mode.** Nodes, elements, dimensions, axes, supports, constraints,
force vectors, reactions, tension, deflection, velocity, acceleration,
clearance, safety margins, solver mesh, undeformed/deformed geometry, load
cases, convergence info.

**Customer/operator mode.** Presentation-quality fixture layout, anticipated
path, launch location, acceleration/operating/brake/stopping zones, backup
capture, sway and ground-clearance envelopes, personnel exclusion zones,
equipment zones, camera and sensor locations, wind direction, expected timing,
maximum speed, stopping location, and major warnings — without solver detail.

**Views/interaction.** Side, front, top, isometric; orbit/pan/zoom; orthographic
and perspective; section clipping; load-case and analysis-run selectors;
undeformed/deformed overlay; adjustable deflection scale; timeline playback,
trajectory scrubber, slow motion; expected-vs-measured overlay; screenshot,
annotated image, presentation PDF, and operator test-preview sheet exports.

**Hard rule.** Visualization consumes solver results only — no calculation
logic in rendering code (Rule 7).

**Risks.** R-7.

---

## MILESTONE 16 — Digital twin and test-data correlation

Import measured channels (time, position, velocity, acceleration, cable
tension, hook load, anchor load, brake force, brake stroke, payload angle,
wind, wheel speed, sensor state, release state).

Preserve raw file, test number, test article, hardware revision, sensor
calibration, sample rate, coordinate convention, channel mapping, units, zero
correction, polarity, filtering, synchronization, missing data, saturation.
**Raw measured data is never overwritten.**

Provide predicted/measured overlay, residual plots, RMSE, peak error, timing
error, energy comparison, calibrated model copies, parameter-estimation
history, and confidence/identifiability warnings. Candidate calibration
parameters: rolling resistance, bearing resistance, drag coefficient, effective
cable stiffness, cable damping, payload damping, brake-force scale, wind
correction.

**Risks.** R-8.

---

## MILESTONE 17 — Truss/frame groundwork and external FEA interface

Groundwork for 2D truss, 2D frame, 3D truss, nonlinear cable/truss, modal, and
transient structural analysis, plus external solver export/import.

**Not implemented:** solid meshing, shell meshing, complex contact, material
plasticity, fracture, or commercial-solver replacement. TALON is a
model-building, load-generation, fixture-configuration, visualization,
traceability, procurement, and reporting front end.

---

## Release gates (every milestone)

1. Existing regression tests pass.
2. New benchmark tests pass.
3. Dimensional consistency verified.
4. Static force residuals meet documented limits.
5. Dynamic energy residuals meet documented limits.
6. Mesh and time-step sensitivity documented.
7. Failure and non-convergence cases tested.
8. Inputs and outputs identify units and coordinate systems.
9. Critical properties have provenance and verification status.
10. Missing data never produces an OK result.
11. Unverified data never appears certified.
12. Reports identify fidelity, assumptions, limitations, unresolved risks.
13. `npm test` passes.
14. `npm run build` passes.
15. `npm audit` reports zero vulnerabilities **or** an accepted exception is
    explicitly documented (see R-0).
16. Existing scenario files migrate without data loss.
17. Existing TALON benchmark results unchanged unless a higher-fidelity model
    is intentionally selected.
18. Milestone report identifies complete, partial, deferred, and unvalidated
    functionality.

---

## Risk register

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| **R-0** | Dev toolchain carries 5 advisories: Vitest **critical** CVSS 9.8 (arbitrary file read/exec when the Vitest **UI** server listens), Vite **high** CVSS 7.5 (`server.fs.deny` bypass on Windows), esbuild **moderate** (any site can read dev-server responses), plus vite-node and @vitest/mocker. Production bundle **unaffected** — `npm audit --omit=dev` reports **0**. | Dev-machine exposure; blocks a clean gate 15 | **Documented accepted exception** (see below). Scheduled as its own upgrade branch, never bundled into feature work. Interim: do not run `vitest --ui`; do not expose the dev server on untrusted networks. |
| **R-1** | Generalized model silently changes CUFTS results | Loss of v1 validation | Adapter keeps v1 solvers untouched; exact-equality regression tests |
| **R-2** | Schema churn breaks saved scenarios | Data loss | Versioned envelopes, explicit migrations, disclosed notes, no silent defaults |
| **R-3** | Nonlinear solvers fail to converge on realistic inputs | Unusable results | Convergence as first-class output; failure tests; parabolic comparison always shown |
| **R-4** | Reduced-order dynamics mistaken for validated FEA | **Safety** | Persistent fidelity badge; Rule 11 enforced in copy review |
| **R-5** | Seeded library/FMEA content mistaken for certified | **Safety** | Seeds marked example-only; tests assert no seed claims verified |
| **R-6** | Optimizer returns a constraint-violating design | **Safety** | Explicit feasibility flag; controlling-constraint reporting; infeasible ≠ best effort |
| **R-7** | Calculations creep into rendering code | Architecture erosion | Architecture test forbidding solver imports in visualization components |
| **R-8** | Calibration overfits and inflates confidence | Misleading results | Residuals, error metrics, identifiability warnings, provenance on calibrated copies |
| **R-9** | Online component data treated as certified | **Safety / legal** | Imported-unverified by default; URL + retrieval date preserved; verified records never overwritten by unverified; respect site terms and access controls |

### Accepted exception — release gate 15

`npm audit` reports 5 vulnerabilities, all confined to **devDependencies**
(Vite, Vitest, vite-node, @vitest/mocker, esbuild). The deployed artifact is a
static bundle that contains none of these packages; `npm audit --omit=dev`
reports **0 vulnerabilities**.

Accepted for M6 because the remediation is a major toolchain upgrade
(Vite 5→8, Vitest 2→4) that would bundle unrelated breaking changes into a
data-model milestone and invalidate the validated v1.0.0 build stack. It is
scheduled as an isolated upgrade with a full benchmark re-run. Reviewed each
milestone; must not remain accepted indefinitely.
