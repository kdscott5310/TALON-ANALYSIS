# Current Task

> **Active package: `6A` — Project store & app shell**
> This is the *only* active work package. Do not start 6B or anything later.
> When 6A is complete and merged, advance this file and `status.json` to 6B.

## Objective

Introduce a `Project`-model-backed Zustand store **alongside** the existing v1
scenario store, able to hold, persist, and reload a `core/model.ts` `Project`,
and mount a minimal read-only "Fixture Editor" surface that displays the loaded
Project. No geometry editing, no template picker UI, no solver runs yet.

This is the foundation the whole M6 editor sits on. Keep it small and correct.

## Why this first

The shipping UI runs on the flat v1 `Scenario` model; the generalized `Project`
model is built and tested but headless (see
`docs/architecture/CURRENT_ARCHITECTURE.md`). 6A is the seam that lets every
later package (6B–6H, and the M7 stores) build on a real Project at runtime,
without touching the validated v1 UI or its locked results.

## In scope

1. `src/state/projectStore.ts` — Zustand store that:
   - holds one active `Project` (plus room to grow to a library later),
   - seeds an initial Project from the CUFTS template
     (`core/templates/cufts.ts`) when storage is empty,
   - persists to localStorage under a **new** key (do not collide with
     `talon-cufts-scenarios-v1`),
   - on load, validates via `core/projectSerialization.ts`; drops corrupt data
     with a **visible notice** and recovers — never a silent default (Rule 10,
     mirror the recovery pattern in `state/store.ts`).
2. A minimal shell surface (new tab in `App.tsx`, e.g. "Fixture Editor") that
   reads the store and shows the Project's identity/metadata read-only.
3. Tests under `src/tests/` (see below).

## Out of scope (do not build now)

- Canvas / pan-zoom / rendering nodes (6C).
- Any node/element/support/load editing (6D–6E).
- Template gallery UI (6B) — 6A just seeds CUFTS directly.
- Property inspector (6F), solver runs or badges (6G), migration of v1
  scenarios into Projects (6H).

## Files to read (only these)

- `src/core/model.ts` — Project shape + integrity check.
- `src/core/projectSerialization.ts` — Project (de)serialization + validation.
- `src/core/templates/cufts.ts` and `core/templates/registry.ts` — how to build
  a CUFTS Project.
- `src/state/store.ts` — the persistence + recovery pattern to mirror.
- `src/App.tsx` — where to mount the new tab.

## Acceptance criteria

- `npm run build` and `npm test` both pass.
- Existing v1 tabs and their behavior are **unchanged**.
- A Project is created from CUFTS, persisted, and survives a page refresh.
- Corrupt persisted Project data recovers with a visible notice, not a silent
  default; missing data is never coerced to 0.
- No engineering math added to UI/store code (Rule 2/7).
- No changes under `src/calculations/`; changes under `src/core/` only if
  strictly required (prefer none) and recorded in `DECISIONS.md`.

## Test requirements (6A)

Add `src/tests/projectStore.test.ts` covering: seed-from-CUFTS when storage
empty; persist → reload round-trip; corrupt-data recovery emits a notice and
falls back; the v1 scenario store is unaffected. See
`docs/development/TEST_REQUIREMENTS.md` §6A.

## Definition of done

1. Code + tests implemented within scope.
2. `npm test` green (≥ 334 + new 6A tests), `npm run build` green.
3. Decisions recorded in `DECISIONS.md`.
4. `status.json` and this file advanced to mark 6A DONE and 6B ACTIVE.
5. Change committed as a single package-scoped commit.
