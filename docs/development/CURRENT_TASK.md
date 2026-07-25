# Current Task

> **Active package: `6F` — Property inspector & provenance**
> This is the *only* active work package. Do not start 6G or anything later.
> When 6F is complete and merged, advance this file and `status.json` to 6G.

## Previously completed

- **6A** Project store & app shell · **6B** Template gallery · **6C** Canvas
  foundation · **6D** Node & element editing (custom projects) ·
- **6E — Supports, constraints & loads — DONE (2026-07-24).** Pure ops in
  `core/projectEdits.ts` (setSupport/addPointForceLoad/addConstraint/addLoadCase/
  addLoadCombination + removals with integrity cascades via
  `normalizeReferences`); `FixtureInspector.tsx` UI; canvas support/load glyphs.
  Combinations never assume a code factor. 374 tests; browser-verified persist
  across reload. See `DECISIONS.md` D-008.

## Objective (6F)

A **property inspector** that edits a selected entity's **dimension-tagged
properties** with units and **provenance / verification state**. Where 6E added
BCs and loads, 6F is about the engineering *quantities* on elements, materials,
and moving bodies — each carried as a `core/provenance.ts` `Quantity` with a
value, unit, and verification state.

## In scope

1. For a selected **element** (e.g. a custom-project cable), edit its
   dimension-tagged `Quantity` properties (diameter, linear mass, MBS, design
   factor, pretension, EA, …): value in the active unit system + a verification
   state selector (`missing` / `provisional` / `estimated` / `userVerified` / …).
2. Show and edit **material** properties similarly (modulus, density, …).
3. Editing preserves provenance rules:
   - a **missing** property shows as *missing*, never `0` (Rule 4);
   - the original **source value** is preserved separately from any derating
     (Rule 5) — do not overwrite it;
   - unverified state never renders as certified (Rule 6/12).
4. Pure, immutable property-edit operations (extend `core/projectEdits.ts` or a
   sibling), unit-tested; dimensional validation via `core/dimensions.ts`.
5. Wire into the `FixtureInspector` (element/material sub-panels).

## Out of scope

- Solver runs / result badges (6G); migration (6H).
- Component-library sourcing UI (that is M7 — 7B/7C).
- Editing derating rules themselves (show/preserve them; full derating UI later).

## Files to read (only these)

- `src/core/provenance.ts` — `Quantity`, `VerificationState`, `isVerified`,
  `isMissing`, `quantity`/`missing`/`provisional`/`estimated`/`derate`.
- `src/core/dimensions.ts` — dimensions + `SI_UNIT` for validation/units.
- `src/core/elements.ts`, `src/core/model.ts` — where element/material
  `Quantity` properties live.
- `src/components/FixtureInspector.tsx` — extend with property editors.
- `src/units/units.ts` — display/convert per dimension.
- `src/core/projectEdits.ts` — pattern for pure immutable ops.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 374 + new 6F tests).
- Property edits are dimensionally consistent; a missing property never renders
  as `0` or “OK”; verification state round-trips and persists across reload;
  derating never overwrites the source value.
- No engineering math in UI (Rules 2/7); no `src/calculations/` changes;
  `src/core/` changes additive and recorded.
- CUFTS + earlier packages unchanged.

## Definition of done

1. Code + tests within scope.
2. `npm test` and `npm run build` green.
3. Decisions recorded in `DECISIONS.md`.
4. `status.json` and this file advanced to mark 6F DONE and 6G ACTIVE.
5. Single package-scoped commit.
