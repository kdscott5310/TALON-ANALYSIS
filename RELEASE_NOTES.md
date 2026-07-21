# Release Notes

## Unreleased — Milestone 6: Generalized model architecture

First milestone of the [v2 roadmap](ROADMAP_V2.md): TALON gains a reusable
project model for cable-supported test fixtures, moving-trolley systems,
crane-supported fixtures, and portable test structures. **CUFTS is preserved as
a built-in template and its results are unchanged.**

- New `src/core/` model layer: projects, templates, nodes, coordinate systems,
  materials, 7 element types, components, supports, constraints, loads, load
  cases, moving bodies, analysis cases, solver results, verification metadata.
- Every engineering property now carries provenance — **verified /
  provisional / estimated / example / missing** — with source, reference, date,
  confidence, and derating. Missing values are `null` and can never be read as
  zero.
- Versioned project files with migration from CUFTS scenario schema v1/v2/v3;
  every migrated field is disclosed as a note.
- 142 tests (up from 115). The new suite asserts **exact equality** of static,
  dynamic, and summary results before vs. after migration.

No UI or solver behavior changes in this milestone — it is an additive model
layer. Existing scenarios, reports, exports, benchmarks, and disclaimers are
untouched.

**Known item:** the development toolchain has 5 advisories (1 critical, 1 high,
3 moderate) affecting Vite/Vitest only. The production bundle is unaffected
(`npm audit --omit=dev` reports 0). Tracked as risk R-0 in the roadmap and
scheduled as its own upgrade, deliberately not bundled into feature work.

## v1.1.0 — Ground-clearance model fix

Corrects an over-conservative ground-clearance check that reported a false
failure when the trolley's capture point sits at or near grade.

- **Capture height above ground** is now an explicit site input, separate
  from the capture-point elevation, so an elevated capture (on a stand or
  raised terrain) is modeled directly.
- The **minimum-clearance requirement applies to the flight span only**
  (up to brake-zone entry); the brake and capture zones — where the
  trolley is meant to descend to the capture — are excluded.
- Scenario **schema v3** with automatic v2→v3 migration (fills the new
  field at 0 = capture-at-grade and discloses it).
- 115 tests passing; build clean on the pinned Vite 5 / Vitest 2 stack.

Migration note: existing saved scenarios load unchanged and behave as
before (capture at grade) until a capture height is entered.

## v1.0.0 — Preliminary-Design Release (Milestone 5)

First release-ready build of the TALON CUFTS Planner. All five milestones
are complete; the numerical kernel is benchmarked and the application is
deployable as a static site.

### Highlights
- Static + dynamic engineering analysis with a five-category status
  engine and full result traceability.
- Scenario library with versioned JSON import/export, schema migration,
  and corrupt-storage recovery.
- Printable engineering report and CSV exports.
- In-app **Validation** tab: 16 hand-calculable benchmarks across units,
  geometry, static cable, equilibrium, anchors, dynamics, and braking —
  the same cases verified in CI.
- Application-wide error boundary with diagnostics.
- 108 automated tests; production build passes from a clean checkout.

### Release status
- **Test status:** 108/108 passing (`npm test`).
- **Build status:** clean (`npm run build`, TypeScript strict).
- **Dependency audit:** 0 vulnerabilities (`npm audit`).
- **Runtime dependencies:** react, react-dom, zustand (all in use).

### Known limitations (see SAFETY_LIMITATIONS.md)
- Cable statics use the parabolic approximation (elastic-catenary and
  segmented models deferred; warned when assumptions degrade).
- Trolley is a point mass; payload sway is not modeled (pendulum
  reference relation only).
- Brake laws are idealized; hardware curves require manufacturer data.
- Front/top/brake-detail views, FMEA, BOM, and cost model are deferred.

### Inputs still requiring licensed-professional / manufacturer validation
Crane load chart & side-load allowances, cable MBS/mass/stiffness,
ecology-block weight, ground friction, brake hardware capacity & curve,
trolley structural rating, rigging WLLs, and the dynamic amplification
factor. Where not entered, the dependent check reports *insufficient
information* — never zero or acceptable. Full list in
[SAFETY_LIMITATIONS.md](SAFETY_LIMITATIONS.md).

---

## Prior milestones

- **v0.5.0 — Milestone 4:** engineering workflow — versioned scenario
  JSON with migration, multi-scenario store with recovery, five-category
  status engine, workflow tabs, comparison view, printable report, CSV
  exports.
- **v0.4.0 — Milestone 3:** trolley dynamics and progressive braking —
  RK4 path-following simulation, three brake laws, energy audit,
  time-history charts, animated playback.
- **v0.3.0 — Milestone 2:** static engineering solvers — parabolic
  cable, master-node equilibrium, crane/anchor checks.
- **v0.2.0 — Milestone 1:** working foundation — Vite/React/TS app, SI
  units, typed models, validation, SVG side view.

See [CHANGELOG.md](CHANGELOG.md) for detailed changes.
