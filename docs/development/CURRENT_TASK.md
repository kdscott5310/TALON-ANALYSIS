# Current Task

> **Active package: `7C` — Import/export & source adapters UI**
> This is the *only* active work package. Do not start 7D or anything later.
> When 7C is complete and merged, advance this file and `status.json` to 7D.

## Previously completed

- **Milestone 6 (6A–6H) — COMPLETE.**
- **7A** library store & browse · **7B — Record & property editor with provenance
  — DONE (2026-07-24).** Pure `core/library/recordEdits.ts` + `LibraryRecordEditor`
  (draft-then-commit via `mergeRecord`, surfaced verified-overwrite refusal,
  markObsolete). 407 tests. See `DECISIONS.md` D-013.

## Objective (7C)

Move library data in and out of the app, and surface the source-adapter
compliance gate — all honestly:

1. **JSON export/import** of the whole library via `core/library/libraryIo.ts`
   (`exportLibraryJson`/`importLibraryJson`).
2. **CSV export/import** via `exportLibraryCsv`/`importLibraryCsv`. Imported CSV
   rows enter as `importedUnverified`; an empty cell becomes *missing*, not 0;
   a CSV can never assert verification (Rule 12) — say so in the UI.
3. **Source attachment**: let a record cite a source document/URL + page for a
   property (references only — no file bytes), and mark imported/online data
   `importedUnverified` with URL + retrieval date.
4. Surface the **source-adapter compliance gating** from
   `core/library/sourceAdapters.ts` (no network adapter ships; search snippets
   are refused as engineering proof; access-control bypass refused).
5. Tests per `TEST_REQUIREMENTS.md` §7C.

## In scope

- Download library as JSON and as CSV; import a library JSON or CSV file
  (malformed rejected with a visible reason; import notes disclosed, e.g. the
  CSV "everything is importedUnverified" note).
- Merge imports into the current library (respecting the verified-overwrite
  rule) or replace it — choose and record the behavior in `DECISIONS.md`.
- A read-only presentation of the adapter contract/compliance rules so users
  understand why online data is never trusted automatically.

## Out of scope

- A live network adapter (none ships; Rule 12 / R-9).
- Sizing / candidate selection (7D), BOM / procurement (7E).

## Files to read (only these)

- `src/core/library/libraryIo.ts` — JSON + CSV import/export (already handles
  the importedUnverified / missing-not-zero rules).
- `src/core/library/sourceAdapters.ts` — adapter contract + compliance gating.
- `src/core/library/componentLibrary.ts` — `mergeRecord` for merging imports.
- `src/state/libraryStore.ts` (`setLibrary`), `src/components/LibraryBrowser.tsx`,
  `src/components/FixtureEditor.tsx` (`triggerDownload` pattern to reuse/mirror).

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 407 + new 7C tests).
- Library JSON/CSV export download; import round-trips (JSON) and marks CSV rows
  importedUnverified with empty→missing; malformed import rejected with a notice.
- Imported/online data never appears verified; the adapter compliance gate is
  presented, not bypassed.
- No engineering math in UI (Rules 2/7); no `src/calculations/` changes;
  `src/core/` changes additive and recorded (prefer none).

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 7C DONE and 7D ACTIVE.
4. Single package-scoped commit.
