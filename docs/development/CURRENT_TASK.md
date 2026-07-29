# Current Task

> **Active package: `7B` — Record & property editor with provenance**
> This is the *only* active work package. Do not start 7C or anything later.
> When 7B is complete and merged, advance this file and `status.json` to 7C.

## Previously completed

- **Milestone 6 (6A–6H) — COMPLETE.**
- **7A — Library store & browse — DONE (2026-07-24).** `state/libraryStore.ts`
  (seed/persist/recover under `talon-library-v1`) + `LibraryBrowser` tab:
  category filter, verification badges, provenance, audit warnings; seeds shown
  EXAMPLE-ONLY / NOT-FOR-DESIGN, never verified. 400 tests. See `DECISIONS.md`
  D-012.

## Objective (7B)

Let the user **create and edit component records and their per-property
provenance** in the library, enforcing the governance rules: a **verified
record is never overwritten by unverified data** (`mergeRecord` already refuses
— surface it), a missing value stays missing (never 0), and **derating never
overwrites the source value** (Rule 5). Reuse the `updatedQuantity` pattern from
6F for value + verification-state edits.

## In scope

1. Create a new record (id, category, name, manufacturer/model/part number) and
   add/remove properties, committing through `mergeRecord` on the library store.
2. Per-property editing: value (active units, via the 6F unit helpers), a
   verification-state selector, and source fields (source type/document/url,
   published/retrieved dates) on the property/record provenance.
3. Enforce and SURFACE the merge rule: attempting to overwrite a verified
   record with unverified data is refused with the returned reason (never a
   silent apply or drop).
4. Mark a record obsolete (`markObsolete`) — retained for history, excluded
   from selection.
5. Tests per `TEST_REQUIREMENTS.md` §7B.

## Out of scope

- Import/export & source-adapter UI (7C).
- Sizing / candidate selection (7D), BOM / procurement (7E).
- Attaching source-document files (references only; file bytes are out of scope).

## Files to read (only these)

- `src/core/library/componentLibrary.ts` — `mergeRecord` (refusal rule),
  `markObsolete`, `ComponentRecord`/`ComponentProperty`, `recordVerificationState`.
- `src/core/provenance.ts` — `Quantity`, `Provenance`, `VerificationState`,
  `isVerified`, `derate` (source-value preservation).
- `src/core/projectEdits.ts` — `updatedQuantity` (reuse the value+state pattern).
- `src/units/units.ts` — dimension-aware display for property values.
- `src/state/libraryStore.ts` (`setLibrary`), `src/components/LibraryBrowser.tsx`.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 400 + new 7B tests).
- Provenance fields round-trip and persist across reload; a missing property
  never renders as 0.
- A verified record is never overwritten by unverified data — the refusal is
  shown to the user with its reason.
- Derating preserves the original source value (Rule 5).
- No engineering math in UI (Rules 2/7); no `src/calculations/` changes;
  `src/core/` changes additive and recorded (prefer none).

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 7B DONE and 7C ACTIVE.
4. Single package-scoped commit.
