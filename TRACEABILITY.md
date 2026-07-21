# Requirements Traceability Matrix

Links PROJECT_SPEC requirements to implementing code, tests, and UI, with
a release status for each. Status legend:

- **Implemented** — built, tested, and available in the UI.
- **Partial** — a preliminary/simplified model is implemented; a
  higher-fidelity model is deferred (labeled in-app).
- **Deferred** — intentionally out of scope for this preliminary release.
- **N/A** — not applicable to a browser-based preliminary-design tool.

All calculated results are preliminary and require professional
validation; see [SAFETY_LIMITATIONS.md](SAFETY_LIMITATIONS.md).

| Spec area | Requirement | Code | Tests | UI | Status |
|---|---|---|---|---|---|
| §2 Inputs | Site geometry inputs w/ units, tooltips, ranges, warnings | `models/scenario.ts`, `components/InputPanel.tsx`, `validation/validate.ts` | `validation.test.ts` | Setup tab | Implemented |
| §2 Inputs | Cable, trolley, crane, anchor, brake, environment inputs | `models/scenario.ts`, `InputPanel.tsx` | `validation.test.ts` | Setup tab | Implemented |
| §2 Inputs | No vendor properties hard-coded as certified facts | `models/exampleScenario.ts` (PROVISIONAL labels) | `scenarioWorkflow.test.ts` | PROVISIONAL flags | Implemented |
| §3.1 | Parabolic static cable model | `calculations/parabolicCable.ts` | `staticSolvers.test.ts`, `benchmarks.ts` | Static tab, side view | Implemented |
| §3.1 | Elastic catenary model | — | — | — | Deferred (labeled in registers) |
| §3.1 | Segmented nonlinear cable model | — | — | — | Deferred (labeled in registers) |
| §3.1 | Sag, lowest point, H tension, reactions, elongation, clearance | `parabolicCable.ts`, `staticAnalysis.ts` | `staticSolvers.test.ts` | Static results | Implemented |
| §3.1 | Warn when parabolic approximation invalid | `parabolicCable.ts` (sag/span, slope warnings) | `invariants.test.ts` (steep) | Warnings panel | Implemented |
| §3.2 | Moving-trolley sag & position sweep | `staticAnalysis.ts`, trolley slider | `staticSolvers.test.ts` | Trolley slider | Implemented |
| §3.3 | Crane resultant load, master-node vector equilibrium | `calculations/masterNode.ts` | `staticSolvers.test.ts`, `benchmarks.ts` (closure) | Static results, force vectors | Implemented |
| §3.3 | Crane capacity margin from USER chart (never invented) | `masterNode.ts` | `staticSolvers.test.ts` | Results (PROVISIONAL) | Implemented |
| §3.3 | Side-load / hook-angle warnings | `masterNode.ts` | `staticSolvers.test.ts` | Warnings | Implemented |
| §3.4 | Trolley time-step motion model | `calculations/trolleyDynamics.ts`, `trolleyPath.ts` | `dynamics.test.ts` | Dynamic tab | Implemented |
| §3.4 | Gravity along tangent, rolling, drag, wind | `trolleyDynamics.ts` | `dynamics.test.ts`, `benchmarks.ts` | Dynamic tab | Implemented |
| §3.4 | Time-history plots (v, x, a, brake force) | `components/TimeHistoryCharts.tsx` | — | Dynamic tab | Implemented |
| §3.5 | Payload sway model (pendulum / coupled) | — | pendulum reference in `benchmarks.ts` | — | Deferred (reference relation only) |
| §3.6 | Brake-energy calculation & concept comparison | `trolleyDynamics.ts` (energy audit), `statusSummary.ts` | `dynamics.test.ts`, `benchmarks.ts` | Dynamic tab, Compare | Implemented (single-run; multi-concept via scenarios) |
| §3 (crit.) | Actual cable profile vs nominal chord distinction | `SideView.tsx` (distinct styles + legend) | — | Side view | Implemented |
| §4 View A | Side elevation with zones, anchors, dimensions | `components/SideView.tsx` | — | All analysis tabs | Implemented |
| §4 Views B–E | Front / top / force / brake-detail views | force vectors in `SideView.tsx` | — | Side view (partial) | Partial (side + force; front/top/brake-detail deferred) |
| §8 | Interlock matrix / permissives | status categories in `statusSummary.ts` | `scenarioWorkflow.test.ts` | Compare/Report status | Partial (status engine; full interlock UI deferred) |
| §9 | FMEA table | — | — | — | Deferred |
| §10 | Bill of materials from demands | — | — | — | Deferred |
| §11 | Cost model | — | — | — | Deferred |
| §12 | Reports & export (JSON/CSV/print) | `reports/reportData.ts`, `reports/csv.ts`, `ReportView.tsx` | `scenarioWorkflow.test.ts` | Report tab | Implemented (design summary, CSV, JSON; crane sheet partial) |
| §13 | Professional engineering dashboard, tabs, print mode | `App.tsx`, `styles.css` (print CSS) | — | Whole app | Implemented |
| §13 | Scenario presets & comparison | `store.ts`, `CompareView.tsx` | `scenarioWorkflow.test.ts` | Compare tab | Implemented (via scenario library) |
| §14 | React/TS/Vite, calc separate from UI, Zod-style validation | project structure, `validation/validate.ts` | all suites | — | Implemented (hand-rolled validation instead of Zod) |
| §14 | Vitest calculation tests | `src/tests/*` (108 tests) | — | — | Implemented |
| §14 | Playwright UI tests | — | — | — | Deferred (manual browser verification performed) |
| §15 | Validation tests / benchmark hand-calcs | `calculations/benchmarks.ts` | `benchmarks.test.ts` | Validation tab | Implemented |
| §16 | Unit switching (US ↔ SI) | `units/units.ts`, header selector | `units.test.ts` | Header | Implemented |
| §17 | Baseline example configuration loaded on startup | `models/exampleScenario.ts` | `scenarioWorkflow.test.ts` | Default scenario | Implemented |
| §M5 | Requirements traceability, benchmarks, error boundary, release docs | this file, `benchmarks.ts`, `ErrorBoundary.tsx`, README | `benchmarks.test.ts`, `invariants.test.ts` | Validation tab | Implemented |

## Deferred items (rationale)

The following are intentionally deferred for this preliminary-design
release and are **not** hidden — each is disclosed in the in-app
registers (Setup tab) and/or this matrix:

- **Elastic catenary & segmented cable models** — the parabolic model is
  labeled and warns when its assumptions are violated. Higher-fidelity
  cable statics require a dedicated solver and validation dataset.
- **Payload sway dynamics (§3.5)** — only the simple-pendulum reference
  relation is provided; a coupled cable–payload model is future work.
- **FMEA, BOM, cost model (§9–§11)** — engineering-management artifacts
  that do not affect the numerical kernel.
- **Front/top/brake-detail views** — side elevation and force diagram are
  implemented; the remaining views are visualization-only additions.
- **Playwright UI tests** — the 108-test Vitest suite covers the
  calculation kernel and data assembly; UI flows were verified manually
  in-browser during each milestone.
