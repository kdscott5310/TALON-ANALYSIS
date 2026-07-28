# Current Task

> **Active package: `7A` — Library store & browse (starts M7)**
> **Milestone 6 is COMPLETE.** This is the *only* active work package.
> When 7A is complete and merged, advance this file and `status.json` to 7B.

## Milestone 6 — COMPLETE (2026-07-24)

Generalized platform + graphical fixture editor, 6A–6H:

- **6A** project store · **6B** template gallery · **6C** 2D canvas ·
  **6D** node/element editing (authoritative custom projects) · **6E**
  supports/constraints/loads · **6F** property inspector & provenance ·
  **6G** analysis runs & fidelity badges (CUFTS; custom deferred) ·
  **6H** project file I/O, v1→project migration, and the **exact-equality
  regression** proving CUFTS results are unchanged through the full Project path.

392 tests, build clean, production audit 0. Decisions D-002…D-011.

## Objective (7A)

Give the built-and-tested **component library** (`core/library/`) its first UI:
load the library, browse/filter records, and show each record's verification
state and provenance honestly. Seeds are visibly example-only.

## In scope

1. `src/state/libraryStore.ts` — a Zustand store over
   `core/library/componentLibrary.ts` + `seedLibrary.ts`, persisted under its
   own localStorage key (mirror the `projectStore` recovery pattern: corrupt
   data dropped with a visible notice, never a silent default).
2. A library browser UI (new tab or a section) listing records with
   category filter, verification-state badges, and provenance summary.
3. Seeded/example records are clearly marked example-only and never shown as
   verified.
4. Tests per `TEST_REQUIREMENTS.md` §7A.

## Out of scope

- Record/property editing (7B), import/export & adapters UI (7C).
- Sizing / candidate selection (7D), BOM / procurement (7E).

## Files to read (only these)

- `src/core/library/componentLibrary.ts` — library type, records, provenance,
  verification, merge/audit rules.
- `src/core/library/seedLibrary.ts` — example-only seed records.
- `src/core/provenance.ts` — `VerificationState`, `isVerified`, `STATE_LABEL`.
- `src/state/projectStore.ts` — the store + persistence/recovery pattern to
  mirror.
- `src/App.tsx` / `src/components/FixtureEditor.tsx` — where to mount the browser.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 392 + new 7A tests).
- Records list with correct verification badges; seeded records never display as
  verified; corrupt persisted data recovers with a visible notice.
- No engineering math in UI (Rules 2/7); no `src/calculations/` changes;
  `src/core/` changes additive and recorded (prefer none).

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 7A DONE and 7B ACTIVE.
4. Single package-scoped commit.
