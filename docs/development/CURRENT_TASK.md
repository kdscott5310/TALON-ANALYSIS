# Current Task

> **Active package: `6B` — Template gallery & new-project flow**
> This is the *only* active work package. Do not start 6C or anything later.
> When 6B is complete and merged, advance this file and `status.json` to the
> next package.

## Previously completed

- **6A — Project store & app shell — DONE (2026-07-24).** Added
  `src/state/projectStore.ts` (Project-backed Zustand store, dedicated
  `talon-project-v1` key, persist via `exportProjectJson` / recover via
  `importProjectJson` with visible notices) and a read-only "Fixture Editor"
  tab (`src/components/FixtureEditor.tsx`). 343 tests pass, build clean,
  browser-verified with no console errors. See `DECISIONS.md` D-002/D-004.

## Objective (6B)

Let the user instantiate a `Project` from the fixture-template registry. Add a
template gallery that lists all templates from `core/templates/registry.ts` with
**CUFTS enabled and every other template visibly locked**; selecting CUFTS
creates a Project (via the template) into the 6A project store.

## Why this next

6A gave us a single seeded Project. 6B makes project creation explicit and
honest: the registry already refuses unimplemented templates
(`instantiateTemplate` throws), so the UI must present locked templates as
locked — never imply a capability TALON does not have (Rule 8/11).

## In scope

1. A template gallery component listing `FIXTURE_TEMPLATES`, each showing name,
   description, status (implemented/planned), and target milestone.
2. Only `implemented` templates are selectable; `planned` templates render
   disabled with their milestone, and cannot create a Project.
3. Selecting CUFTS calls `instantiateTemplate('cufts', exampleScenario, …)` (or
   `buildCuftsProject`) and loads the result into the project store via
   `setProject`.
4. Surface it from the Fixture Editor tab (e.g. a "New from template" control).
5. Tests per `TEST_REQUIREMENTS.md` §6B.

## Out of scope (do not build now)

- Canvas / rendering nodes (6C) and any geometry editing (6D–6E).
- Property inspector (6F), solver runs / badges (6G).
- Migrating existing v1 scenarios into Projects (6H).
- Custom or user-saved templates (planned; stay locked).

## Files to read (only these)

- `src/core/templates/registry.ts` — `FIXTURE_TEMPLATES`, `instantiateTemplate`,
  `implementedTemplates` / `plannedTemplates`.
- `src/core/templates/cufts.ts` — `buildCuftsProject`.
- `src/state/projectStore.ts` — `setProject`, `seedExampleProject`.
- `src/components/FixtureEditor.tsx` — where to mount the gallery.
- `src/models/exampleScenario.ts` — the CUFTS seed scenario.

## Acceptance criteria

- `npm run build` and `npm test` both pass (≥ 343 + new 6B tests).
- Only implemented templates can create a Project; a locked template cannot
  (the registry throw is prevented in the UI, not swallowed after the fact).
- Creating CUFTS produces a Project matching the template definition, loaded
  into the store.
- Existing v1 tabs and 6A behavior unchanged.
- No engineering math in UI code (Rule 2/7); no changes under
  `src/calculations/`; `src/core/` unchanged unless strictly required (record
  in `DECISIONS.md`).

## Definition of done

1. Code + tests implemented within scope.
2. `npm test` and `npm run build` green.
3. Decisions recorded in `DECISIONS.md`.
4. `status.json` and this file advanced to mark 6B DONE and 6C ACTIVE.
5. Change committed as a single package-scoped commit.
