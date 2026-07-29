# Current Task

> **No active package. Milestones 6 and 7 are both COMPLETE.**
> Pick the next milestone/work before setting an active package here and in
> `status.json`.

## Milestones 6 & 7 — COMPLETE (2026-07-24)

**M6 — Generalized platform + graphical fixture editor (6A–6H):** project store,
template gallery, 2D editor canvas, node/element editing on authoritative custom
projects, supports/constraints/loads, dimensioned property editing with
provenance, analysis runs + fidelity badges (CUFTS), and project file I/O + v1
migration + the exact-equality CUFTS regression.

**M7 — Component library + procurement (7A–7E):** library store & browse,
record & property editor (verified-overwrite refusal surfaced), import/export &
source-adapter compliance, sizing & candidate selection, and BOM + procurement
search sheet / RFQ.

421 tests, build clean, production audit 0. The validated v1 CUFTS UI and its
Level-1 results are unchanged throughout. Decisions D-001…D-016.

## Candidate next work (not yet scheduled)

Pick one and write a package brief here + set the active pointer in
`status.json` before implementing.

- **Custom-project analysis** — wire `calculations/trussFEM.ts` (2D truss
  direct-stiffness, Level 2) to custom projects, with honest applicability when
  E·A / restraints / loads are missing (deferred in 6G, D-010).
- **Durable analysis-run history** — persist frozen `AnalysisRun`s (6G holds
  them in view state only).
- **Surface the M8–M17 engines** — nonlinear cable (M8), coupled dynamics
  (M9), brake curves (M10), lateral cable (M11), uncertainty/optimization (M12),
  FMEA/hazard register (M14), digital-twin correlation (M16), truss/FEA export
  (M17) all have tested cores but limited/no UI beyond what M6/M7 added.
- **CUFTS→editor bridge** — let the fixture editor open the migrated CUFTS
  project's geometry read-only alongside its analysis (today CUFTS geometry is
  derived and read-only; the editor edits custom projects).

## How to start the next package

1. Choose the package; write its brief in this file (objective, in/out of scope,
   files to read, acceptance, DoD) as for 6A–7E.
2. Set `activePackage` + the package `status: "active"` in `status.json`
   (clear `phaseComplete`).
3. Branch `milestone-<id>-<slug>`, implement, test, browser-verify, record a
   decision, commit, merge to `main`, push.
