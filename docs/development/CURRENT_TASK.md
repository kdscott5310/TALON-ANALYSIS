# Current Task

> **No active package.** Milestones 6, 7, 8 and 9 are all COMPLETE.
> Pick the next piece of work, write its brief here, and set the active pointer
> in `status.json` before implementing.

## Delivered

**M6 — Generalized platform + graphical fixture editor (6A–6H)** · **M7 —
Component library + procurement (7A–7E)** · **M8 — Advanced analysis UIs
(8A–8D)** · **M9 — Git-based sharing (9A–9B)**.

The four analysis capabilities requested, plus design saving and standards
sharing:

| Capability | Tab | Package |
|---|---|---|
| Brake curves & stopping simulation | Brake Curves | 8A |
| Coupled dynamics (wheel inertia + payload pendulum) | Coupled Dynamics | 8B |
| Design optimization | Optimization | 8C |
| Digital twin (measured-data correlation) | Digital Twin | 8D |
| Shared engineering standards (Git-versioned) | Standards | 9A |
| Named project drafts, save/load/export | Fixture Editor | 9B |

479 tests, 40 files. Build clean, production audit 0. The validated v1 CUFTS UI
and its Level-1 results are unchanged throughout — proven by the exact-equality
regression (6H) and the optimizer's baseline-fidelity assertion (8C).
Decisions D-001…D-023.

## Known state / carry-forwards

- **Digital twin has no real data yet** (user). The panel ships a deterministic,
  clearly-labelled synthetic demo so the workflow is exercisable; swap in a real
  CSV (header row, time in seconds first column, one column per channel) when
  test data exists.
- **The example CUFTS scenario is genuinely infeasible** — ground clearance,
  anchor sliding, and cable utilization all violate at baseline (consistent with
  its "NOT ACCEPTABLE" status badge). Optimization correctly refuses to present
  it as a valid design. Real verified inputs are needed before results mean
  anything.
- Migrated CUFTS projects mark wheel inertia, payload damping, brake energy
  capacity, cable EA/unstretched length as **missing**; the panels report
  *insufficient information* until entered.
- **Custom-project analysis** is still deferred (`trussFEM.ts` not wired to
  custom projects; D-010).
- **Durable analysis-run history** — 6G runs live in view state only.
- Sharing is **file + Git** by design (D-017). A real-time multi-user backend
  remains a separate, larger option (hosting, auth, cost, security review).

## Candidate next work

- Wire `trussFEM.ts` to custom projects (with honest applicability when E·A /
  restraints / loads are missing).
- Persist analysis runs so a project carries its result history.
- Feed a real CUFTS dynamics acceleration history into the payload pendulum
  (8B currently synthesises a braking pulse).
- Surface remaining engines: nonlinear cable (M8 core), lateral cable (M11),
  FMEA / hazard register (M14), truss/FEA export (M17).
- Uncertainty & sensitivity sweeps UI (the other half of M12).

## How to start the next package

1. Write the brief here (objective, in/out of scope, files to read, acceptance,
   DoD), as for 6A–9B.
2. Set `activePackage` + that package `status: "active"` in `status.json`
   (clear `phaseComplete`).
3. Branch `milestone-<id>-<slug>`, implement, test, browser-verify, record a
   decision, commit, merge to `main`, push.
