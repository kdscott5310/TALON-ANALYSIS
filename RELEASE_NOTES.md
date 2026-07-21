# Release Notes

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
