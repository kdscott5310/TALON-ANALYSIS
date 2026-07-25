# Decisions Log

Short, append-only record of architectural decisions for the M6/M7 UI phase.
One entry per decision. Newest first. Record any non-obvious choice a package
makes so later sessions don't re-litigate it.

Format:

```
## D-NNN — <title>  (YYYY-MM-DD, package)
**Decision.** …
**Why.** …
**Consequences / alternatives rejected.** …
```

---

## D-004 — 6A persistence reuses the validated serialization path  (2026-07-24, 6A)

**Decision.** The project store (`src/state/projectStore.ts`) persists by writing
`exportProjectJson(project)` and loads by running `importProjectJson(raw)` —
the same tested path used for file import. Storage uses a dedicated key
`talon-project-v1`. A read-only "Fixture Editor" tab was added by extending the
v1 store's `WorkflowTab` union with `'editor'` (navigation only).

**Why.** Routing load through `importProjectJson` means corrupt or hand-edited
saved data is re-validated and re-derived from the CUFTS scenario on every load,
so recovery is honest (visible notice, never a silent default — Rule 10) and
missing quantities stay `null` (Rule 4). Reusing the serializer avoids a second,
divergent persistence format.

**Consequences.** Reloading a freshly seeded project re-derives it
deterministically (ids/timestamps preserved), so the round-trip is lossless and
`toEqual`-stable — asserted in `src/tests/projectStore.test.ts`. The store
exposes only an immutable `setProject`, `resetToExampleProject`, and
`toProjectJson`; graphical editing is deferred to 6C+.

## D-003 — Split M6/M7 into lettered work packages  (2026-07-24, docs)

**Decision.** M6 (generalized platform + graphical fixture editor) is divided
into `6A–6H`; M7 (component library + procurement) into `7A–7E`. Each package is
one focused, independently reviewable session.

**Why.** The engineering cores are large and already built; the remaining work
is UI/integration that benefits from small, testable increments and low
per-session context. Lettered packages keep exactly one thing active.

**Consequences.** `status.json` tracks a single ACTIVE pointer; agents load only
the files a package needs (`FILE_MAP.md`). Note: these M6/M7 letters denote the
*UI-adoption* phase and are distinct from the original numeric milestones M6–M17
whose solver cores already landed in `main`.

## D-002 — Parallel Project store, not a rewrite of the v1 store  (2026-07-24, 6A design)

**Decision.** 6A adds a new `projectStore` beside the existing v1 `store.ts`
rather than migrating the v1 UI onto the `Project` model in place. Persistence
uses a new localStorage key.

**Why.** The v1 CUFTS UI and its Level-1 results are validated and must keep
working unchanged (Rule 1). A parallel store lets the editor grow on the
`Project` model while the v1 tabs stay untouched; migration of v1 scenarios into
Projects is deferred to 6H.

**Consequences.** Two stores coexist during the transition; a later package may
converge them once the editor reaches parity. Rejected: big-bang replacement
(risks the locked regression) and runtime Scenario↔Project shims in the v1 tabs
(unnecessary coupling).

## D-001 — Reuse existing engines; UI adds no engineering math  (2026-07-24, phase)

**Decision.** The M6/M7 UI phase consumes the already-built solvers and core
modules through their existing contracts (`core/solver.ts`,
`core/projectAnalysis.ts`, `calculations/*`, `core/library/*`,
`reports/procurementSheet.ts`). No new solvers, fidelity levels, or calculation
logic in UI/store/rendering code.

**Why.** Rules 2 and 7: engineering math stays out of React and out of
rendering. The engines are tested; duplicating logic in the UI would risk
divergence and erode the validated boundary.

**Consequences.** UI packages are presentation + orchestration only. Any gap
found in an engine is raised as its own change, not patched inside a component.
Rejected: convenience calculations in components (violates the architecture
tests and safety rules).
