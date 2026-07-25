# Test Requirements

Test gates for the M6/M7 UI phase. Every package must leave `npm test` and
`npm run build` green. Baseline at phase start: **334 tests, 21 files**.

## Global gates (every package)

1. `npm test` passes; no test count regression (new tests only add).
2. `npm run build` passes (`tsc -b` strict + `vite build`).
3. **CUFTS regression stays exact.** Existing benchmark/invariant/scenario tests
   for the v1 CUFTS results must be untouched and passing. Never edit a test to
   make new code pass a locked result.
4. `npm audit --omit=dev` remains **0** (dev-only advisories R-0 excepted).
5. New tests live in `src/tests/*.test.ts`, are deterministic, and exercise the
   engine/store directly (no DOM needed for logic).
6. Any behavior that could silently violate a safety rule (missing→0,
   unverified→certified, level inflation, non-frozen run) has an explicit
   negative test.

## What to test where

- **Stores** (`src/state/*`): seed, persist→reload round-trip, corrupt-data
  recovery with notice, no cross-store interference. Logic-level, using a
  localStorage stub as the existing suites do.
- **Editor/UI orchestration**: assert it produces valid model data and renders
  engine results faithfully — not that it recomputes anything. Keep assertions
  on store/model state, not pixels.
- **Engines**: already covered; only add tests if a package legitimately extends
  an engine (record the reason in `DECISIONS.md`).

## Per-package requirements

### 6A — Project store & app shell
- Seeds a CUFTS Project when storage is empty.
- Persist → reload round-trip preserves the Project.
- Corrupt persisted data → recovery with a visible notice, no silent default,
  no value coerced to 0.
- The v1 scenario store/tabs are unaffected (regression suite unchanged).
- File: `src/tests/projectStore.test.ts`.

### 6B — Template gallery & new-project flow
- Only implemented templates instantiate; a locked template cannot create a
  Project (registry throw surfaced, not swallowed).
- Instantiated CUFTS Project matches the template definition.

### 6C — Canvas foundation
- Scene mapping from Project → drawable primitives is pure and correct at known
  coordinates (test the mapping function, not the canvas).
- No solver import in canvas modules (architecture assertion).

### 6D — Node & element editing
- Add/move/delete node and element operations yield a Project that passes
  `model.ts` integrity checks.
- Edits are immutable (previous Project reference unchanged).
- Dimensions display converts via `units/units.ts` (no ad-hoc math).

### 6E — Supports, constraints & loads
- Supports/constraints/loads persist on the Project.
- Load combinations are user-defined only; no code-factor constants introduced.
- Load vectors carry their coordinate frame.

### 6F — Property inspector & provenance
- Property edits are dimensionally validated (`dimensions.ts`); incompatible
  units rejected.
- Verification state + source round-trip through the store.
- A missing property renders as *missing*, never 0 or "OK".

### 6G — Analysis-run wiring & fidelity badges
- Runs are frozen/fingerprinted and reproducible (same inputs → identical run).
- Result metadata is complete (solver id/version, fidelity, applicability,
  convergence, certification status).
- Level claim never exceeds the computed level; failed/non-convergent/
  insufficient cases surface as such, not OK.

### 6H — Serialization, migration & regression
- Project JSON round-trip is lossless.
- v1 scenarios migrate into Projects with disclosed notes and no data loss.
- **End-to-end exact-equality**: CUFTS static/dynamic/summary via the Project
  path equals the v1 result bit-for-bit.

### 7A — Library store & browse
- Store seed/persist/reload/recovery (as 6A).
- Seeded records never report a verified state.

### 7B — Record & property editor with provenance
- A verified record is never overwritten by unverified data.
- Derating preserves the original source value separately (Rule 5).
- Provenance fields round-trip.

### 7C — Import/export & source adapters UI
- CSV import never asserts verification; imported records are
  `importedUnverified` with URL + retrieval date.
- Empty CSV cells become *missing*, not 0.
- Source-adapter compliance gating is honored (no bypassing access controls).

### 7D — Sizing & candidate selection
- Ranking never auto-selects the smallest passing candidate without
  alternatives.
- Obsolete/unverified excluded when verified data is required.
- Missing rating → insufficient information, never adequate.

### 7E — BOM & procurement sheet
- Exports distinguish calculated requirement / recommended minimum / selected /
  verified.
- Unselected demands are marked PROCUREMENT REQUIRED.
- No fabricated parts for no-candidate demands.
