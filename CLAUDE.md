# CLAUDE.md — TALON Analysis

Agent guide for token-efficient milestone development. Read this first, then
read `docs/development/CURRENT_TASK.md` for the one active work package.

## What this is

TALON is an **engineering planning and analysis platform** for mechanical test
fixtures (cable/crane/trolley/drop/rail/tower systems). It started as the CUFTS
planner (Captive UAS Final-Approach Test System) and is generalizing into a
reusable platform with a graphical fixture editor, component library,
procurement, FMEA, optimization, digital-twin correlation, and 3D
visualization.

It is a **preliminary-analysis tool**. It never replaces licensed engineering
review, load charts, rigging/structural certification, or manufacturer data.
See `SAFETY_LIMITATIONS.md`.

## Stack & commands

- Vite + React 18 + TypeScript (strict), Zustand store, Three.js / React Three
  Fiber (lazy-loaded), Vitest. No backend — build is a static bundle.

```bash
npm install       # dependencies
npm run dev       # dev server → http://localhost:5173
npm test          # Vitest (currently 334 tests, 21 files)
npm run build     # tsc -b + vite build → dist/
```

Node 18+. Platform is Windows; the shell is PowerShell (Bash tool also
available). Prefer the browser preview tools over raw dev-server shelling.

## Repository state (read carefully)

The engineering **cores for Milestones 6–17 are already built, tested, and
merged into `main`** — they live in `src/core/` and `src/calculations/`. What
is **missing is the UI/platform layer**:

- The React UI still runs on the **v1 `Scenario` model** (`src/models/`), not
  the generalized **`Project` model** (`src/core/model.ts`).
- There is **no graphical fixture editor**.
- The component library, procurement/BOM, FMEA, optimization, uncertainty, and
  digital-twin engines have **no UI** — they are pure modules with tests only.

The current development phase wires these cores into the product. See
`docs/architecture/CURRENT_ARCHITECTURE.md` and `TARGET_ARCHITECTURE.md`.

## Milestones (this phase)

Two milestones, split into small work packages so each fits one focused
session. Full detail in `docs/development/MILESTONES.md`.

- **M6 — Generalized platform + graphical fixture editor**: `6A … 6H`
- **M7 — Component library + procurement**: `7A … 7E`

**Only `6A` is active.** Do not start any other package. The active package is
always named in `docs/development/CURRENT_TASK.md` and `status.json`.

## How to work a package

1. Read `docs/development/CURRENT_TASK.md` — it is the scope contract.
2. Read only the files in `docs/development/FILE_MAP.md` that the package
   touches. Do not load the whole tree.
3. Implement inside the package's scope. Do not scope-creep into later
   packages.
4. Satisfy `docs/development/TEST_REQUIREMENTS.md` for that package. Add tests
   under `src/tests/`.
5. Run `npm test` and `npm run build`; both must pass.
6. Record any non-obvious choice in `docs/development/DECISIONS.md`.
7. Update `status.json` and `CURRENT_TASK.md` to advance the active pointer.

Keep diffs small. One package = one reviewable change set.

## Non-negotiable engineering rules

These are safety and correctness rules. They override convenience. Full list in
`ROADMAP_V2.md` (governance) — the ones that constrain almost every change:

1. **Never change validated v1 CUFTS results.** CUFTS is a fixture template;
   its static/dynamic/summary outputs are locked by exact-equality regression
   tests. Higher-fidelity results appear only when a user *intentionally*
   selects a higher-fidelity solver.
2. **Engineering math stays out of React.** Solvers live in `calculations/` and
   `core/`; components consume results only. Visualization code contains **no**
   calculation logic (`src/visualizations/sceneData.ts` is the only
   solver→scene mapping and it is pure).
3. **SI internally.** Convert only at the input/display boundary
   (`src/units/units.ts`). Never mix unit systems inside a solver.
4. **Missing data is never zero and never "OK".** A missing rating/property
   yields *insufficient information*, not `0` and not a passing check.
5. **Preserve source values.** Derating/conditioning never overwrites the
   original source value; keep them separate (provenance in `core/provenance.ts`).
6. **Unverified never appears certified.** Online/seed/example data is marked
   `importedUnverified`/`exampleOnly`; a verified record is never overwritten
   by an unverified one.
7. **Every result carries its metadata**: solver id + version, fidelity level
   (0–3), units, coordinate frame, assumptions, convergence, applicability,
   verification status, limitations. Use the `core/solver.ts` contract.
8. **Reduced-order dynamics is not FEA.** Label it persistently (Rule 11).
9. **Deterministic & reproducible.** Analysis runs are frozen/fingerprinted
   (`core/analysisRun.ts`). Same inputs → identical outputs.
10. **Migrate saved data without loss.** Schema changes ship with explicit
    migrations and disclosed notes; no silent defaults.

## Fidelity levels

Every result shows a level. Do not claim a level you did not compute.

| Level | Meaning |
|---|---|
| 0 | Screening — conservative hand calcs |
| 1 | Preliminary — parabolic cable, rigid trolley, idealized brakes (v1 solvers) |
| 2 | Advanced preliminary — elastic catenary, coupled dynamics, lateral cable, brake curves, uncertainty/optimization |
| 3 | External validated — imported/correlated with a validated external solver |

## Architecture map (where things live)

```
src/
  core/           generalized platform model (M6) + libraries (M7) + FMEA (M14)
    model.ts        Project aggregate + integrity
    dimensions.ts   dimensional types & algebra (SI)
    coordinates.ts  8 coordinate-frame kinds, frame-tagged vectors
    provenance.ts   verification states, source-preserving derating
    solver.ts       solver contract: fidelity, applicability, acceptance, badge
    analysisRun.ts  frozen, fingerprinted, reproducible runs
    elements.ts     element types
    templates/      fixture-template registry (only CUFTS implemented)
    library/        component library, IO, source adapters, seed
  calculations/   engineering solvers, all React-independent, all unit-tested
                  (parabolic + elastic catenary, trolley/wheel/pendulum
                   dynamics, brake curves, lateral cable, sensitivity,
                   optimization, component sizing, truss FEM, correlation)
  visualizations/ pure solver→3D scene mapping (sceneData.ts)
  models/         v1 Scenario model + serialization (CURRENT UI runs on this)
  units/          SI unit system + display conversion
  validation/     input validation (blocking errors vs advisory warnings)
  state/          Zustand store (v1 scenario library + workflow tabs)
  reports/        report data assembly, CSV, procurement sheet
  components/     React UI (v1 CUFTS tabs + 3D view)
  tests/          Vitest suites
```

Detailed, current file list: `docs/development/FILE_MAP.md`.

## Docs index

- `docs/development/CURRENT_TASK.md` — the single active package (start here)
- `docs/development/MILESTONES.md` — 6A–6H, 7A–7E definitions
- `docs/development/FILE_MAP.md` — active source files
- `docs/development/DECISIONS.md` — architectural decisions log
- `docs/development/TEST_REQUIREMENTS.md` — test gates per package
- `docs/development/status.json` — machine-readable status
- `docs/architecture/CURRENT_ARCHITECTURE.md` / `TARGET_ARCHITECTURE.md`
- `ROADMAP_V2.md` — full governance, fidelity, risk register (source of truth)
- `PROJECT_SPEC.md`, `TRACEABILITY.md`, `VALIDATION.md`, `SAFETY_LIMITATIONS.md`

## Guardrails for agents

- Do **not** modify files under `src/calculations/` or `src/core/` unless the
  active package explicitly requires it; those cores are validated.
- Do **not** edit CUFTS template outputs or the v1 scenario math.
- Do **not** add runtime dependencies without recording the decision.
- Keep `npm audit --omit=dev` at **0**. Dev-only advisories are an accepted,
  documented exception (R-0 in `ROADMAP_V2.md`).
- Commit only what the active package covers. Do not begin the next package.
