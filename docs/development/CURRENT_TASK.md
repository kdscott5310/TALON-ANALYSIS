# Current Task

> **Active package: `9B` — Project draft library & save/load for repo sharing**
> Second package of **M9 — Git-based sharing**. Only 9B is active.

## Previously completed (this phase)

- **8A — Brake curves & stopping simulation — DONE.**
- **9A — Standards library import/sync — DONE (2026-07-24).** `core/standards.ts`
  + `standardsIo.ts` + `standardsStore.ts` + `StandardsPanel` (new "Standards"
  tab): design factors, allowable limits, verification policy, combination
  templates; export/import JSON for Git-versioning; starter template flagged.
  436 tests. See `DECISIONS.md` D-019.
- Milestones 6 & 7 complete; 8B/8C/8D (coupled dynamics, optimization, digital
  twin) still queued in the analysis stream.

## Objective (9B)

Let engineers **keep multiple named project drafts** and **pull up the latest
draft to continue optimizing** — the "keep what everyone is adjusting" workflow —
within the client-only/Git-based model. Today `projectStore` holds ONE active
project; 9B adds a saved-draft **library** with save/load/duplicate/delete and
export/import for repo sharing (building on 6H's project JSON I/O).

## In scope

1. Extend `state/projectStore.ts` (or a sibling) to hold a **library of named
   project drafts** (id, name, savedOn, revision) plus the active one, persisted
   under its own key with corrupt-data recovery. Save current / load / rename /
   duplicate / delete a draft.
2. A drafts UI (in the Fixture Editor or a section): list drafts with savedOn,
   load one to continue editing, save the active project as a new/updated draft.
3. Reuse 6H export/import: export a draft as `talon-project` JSON to commit to
   the repo; import a colleague's file as a new draft. Disclose migration notes;
   malformed rejected with a reason.
4. A short "latest draft" workflow note (export → commit/push → others pull →
   import), consistent with the Standards panel.
5. Tests per `TEST_REQUIREMENTS.md` §9B.

## Out of scope

- A real-time multi-user backend / live concurrent editing (deferred, D-017).
- Automatic Git operations from the browser (the app reads/writes files; the
  engineer does the pull/commit/push).
- Merging two engineers' edits automatically (resolve like code / in Git).

## Files to read (only these)

- `src/state/projectStore.ts` — active project + persistence to extend.
- `src/core/projectSerialization.ts` — `exportProjectJson` / `importProjectJson`.
- `src/components/FixtureEditor.tsx` — `ProjectFilePanel` (6H) to build on.
- `src/state/store.ts` — v1 scenario library is a reference pattern for a
  multi-item store with persistence/recovery.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 436 + new 9B tests).
- Multiple named drafts persist and survive reload; save/load/rename/duplicate/
  delete work; corrupt persisted data recovers with a visible notice.
- Export/import round-trips a draft losslessly (custom projects) and migrates a
  v1 scenario/CUFTS project with disclosed notes; malformed rejected.
- No engineering math in UI (Rules 2/7); no `src/calculations/` changes;
  `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 9B DONE (M9 complete).
4. Single package-scoped commit.
