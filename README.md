# TALON Engineering Suite — CUFTS Planner

Preliminary engineering planning and analysis tool for a **Captive UAS
Final-Approach Test System (CUFTS)**: a crane-supported elevated cable,
an instrumented downhill trolley, progressive ground braking, and
ballast/anchor systems.

> **This application produces preliminary engineering estimates only.**
> It is not a substitute for a licensed engineer, crane manufacturer,
> qualified rigger, certified lift director, structural engineer, or
> site-specific safety review. Every result requires professional
> validation before any physical test. See
> [SAFETY_LIMITATIONS.md](SAFETY_LIMITATIONS.md).

## What it does

- **Static analysis** — parabolic cable statics per leg, master-node
  vector equilibrium, crane hook resultant and capacity margin, anchor
  sliding/uplift checks, ground clearance, all swept over trolley
  position.
- **Dynamic analysis** — RK4 time-step trolley simulation along the
  solved cable path (gravity, rolling resistance, aerodynamic drag,
  along-track wind), three selectable progressive brake laws, energy
  audit, and time-history plots with animated playback.
- **Scenarios** — create, duplicate, rename, delete, import, and export
  configurations as versioned JSON; browser-persisted with schema
  migration and corrupt-data recovery.
- **Comparison** — selected scenarios side by side with a five-category
  status (OK / caution / failed / insufficient info / solver error) and
  full traceability (units, solver, inputs, assumptions).
- **Reports** — printable engineering report (browser print / Save as
  PDF), plus CSV export of summary results and dynamic time histories.
- **Validation** — an in-app benchmark panel comparing solver outputs
  against independent hand calculations; the same cases run in CI.

## Quick start

Requires Node.js 18+.

```bash
npm install       # install dependencies
npm run dev       # start the dev server (http://localhost:5173)
npm test          # run the calculation test suite (108 tests)
npm run build     # type-check and produce a production build in dist/
npm run preview   # serve the production build locally
```

## Deployment (static host)

The build output is a fully static bundle — no server or database.

```bash
npm run build     # emits dist/
```

Serve `dist/` from any static host (GitHub Pages, Netlify, S3, nginx,
`npx serve dist`). If deploying under a sub-path, set Vite's `base`
option in `vite.config.ts` accordingly. No environment variables,
secrets, or backend services are required.

## Project structure

```
src/
  calculations/   engineering solvers (unit-tested, UI-independent)
    parabolicCable.ts   masterNode.ts   anchorCheck.ts
    staticAnalysis.ts   trolleyPath.ts  trolleyDynamics.ts
    dynamicsAnalysis.ts statusSummary.ts benchmarks.ts
  models/         typed scenario model, example, JSON serialization
  units/          SI-internal unit system + display conversions
  validation/     input validation (blocking errors + advisory warnings)
  state/          Zustand store (scenario library, persistence)
  reports/        report data assembly + CSV export
  components/      React UI (panels, views, charts, error boundary)
  tests/          Vitest suites (units, static, dynamics, workflow,
                  benchmarks, invariants)
```

**All engineering math lives in `calculations/` and is independent of
React.** Internal calculations use SI units; conversions happen only at
the input/display boundary (`units/units.ts`).

## Engineering models & verification status

| Model | Method | Status |
|---|---|---|
| Unit conversions | Exact NIST factors | Verified (benchmarks + tests) |
| Site geometry | Coordinate geometry, nominal chord | Verified |
| Static cable | Parabolic approximation (Irvine) | Verified vs closed-form; **preliminary** — warns when sag/span > 8% or slope > 30° |
| Master-node equilibrium | 2D vector statics | Verified (force-balance closure < 1e-6 N) |
| Crane load | Resultant + user-entered capacity margin | Verified; capacity is **user input**, never a built-in crane chart |
| Anchors | Coulomb sliding + dead-weight uplift | Verified; friction/weight are **provisional** field inputs |
| Trolley dynamics | RK4 along influence-line path | Verified vs analytic benchmarks; energy audit < 1% |
| Braking | Constant / linear-ramp / velocity-proportional | Verified vs closed-form stopping distance & decay |
| Payload sway | — | **Deferred**; only a pendulum reference relation is shown |
| Elastic catenary / segmented cable | — | **Deferred** |

See [TRACEABILITY.md](TRACEABILITY.md) for the full requirement-by-
requirement matrix and [VALIDATION.md](VALIDATION.md) for numerical
tolerances and time-step sensitivity.

## Limitations

The models are preliminary and simplified. Key deferrals and cautions:

- Cable statics use the parabolic approximation with horizontal tension
  fixed at the pretension value (no elastic geometric stiffening under
  load). A warning is shown when the approximation degrades.
- The trolley is a point mass; payload pendulum sway, wheel rotating
  inertia, and lateral/out-of-plane cable dynamics are not modeled.
- Brake response follows idealized laws; real hardware curves require
  manufacturer data.
- Crane capacity, cable strength, ecology-block weight, ground friction,
  brake capacity, and trolley rating are **user inputs**. Where not
  entered, the corresponding check reports *insufficient information* —
  never zero or "acceptable".

Full detail: [SAFETY_LIMITATIONS.md](SAFETY_LIMITATIONS.md).

## Documentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — engineering source of truth
- [TRACEABILITY.md](TRACEABILITY.md) — requirement → code/test/UI matrix
- [VALIDATION.md](VALIDATION.md) — benchmarks, tolerances, sensitivity
- [SAFETY_LIMITATIONS.md](SAFETY_LIMITATIONS.md) — model limits & items
  requiring professional validation
- [RELEASE_NOTES.md](RELEASE_NOTES.md) — version history & release status
- [CHANGELOG.md](CHANGELOG.md) — detailed change log
- [TASKLIST.md](TASKLIST.md) — milestone status & registers

## Screenshots

_Screenshots are not bundled in this repository. To capture the UI, run
`npm run dev` and view the Setup, Static Analysis, Dynamic Analysis,
Compare, Report, and Validation tabs, or use the Report tab's
"Print / Save as PDF" for a full-page render._
