# Current Task

> **Active package: `7E` — BOM & procurement sheet (closes M7)**
> This is the *only* active work package. When 7E is complete and merged, M7 is
> done — advance `status.json` and pick the next milestone.

## Previously completed

- **Milestone 6 (6A–6H) — COMPLETE.**
- **7A** library store & browse · **7B** record & property editor · **7C**
  import/export & source adapters ·
- **7D — Sizing & candidate selection — DONE (2026-07-24).**
  `LibrarySizingPanel` over `calculations/componentSizing.sizeComponent`: shows
  every candidate with published/derated rating, utilization, margin,
  verification, controlling criterion; never auto-picks the smallest; missing→
  insufficient; verified-required excludes seeds. 418 tests. See `DECISIONS.md`
  D-015.

## Objective (7E)

Assemble a **bill of materials** from sizing results and generate a
**procurement search sheet / RFQ**, distinguishing calculated requirement /
recommended minimum / selected component / verified component. A demand with no
passing candidate becomes a **procurement line**, never a fabricated part.

## In scope

1. Collect one or more sizing results (extend the 7D flow to keep a list of
   demands, or size several categories) and call `assembleBom`
   (`calculations/componentSizing.ts`) to build BOM lines.
2. A procurement output via `reports/procurementSheet.ts`: search-phrase
   generator, RFQ text, and CSV that mark unselected demands PROCUREMENT
   REQUIRED and distinguish calculated requirement / recommended minimum /
   selected / verified.
3. Export the BOM/procurement sheet as CSV (reuse the `triggerDownload`/download
   pattern) and show the RFQ text.
4. Tests per `TEST_REQUIREMENTS.md` §7E.

## Out of scope

- New engineering math (the sizing + procurement engines exist).
- Optimization (M12), cost roll-up beyond what `procurementSheet` provides.

## Files to read (only these)

- `src/reports/procurementSheet.ts` — search-phrase / RFQ / CSV generators and
  the four-way distinction (read its exact API; do not change it).
- `src/calculations/componentSizing.ts` — `assembleBom`, `SizingResult`,
  `SizedBomLine`.
- `src/components/LibrarySizingPanel.tsx` — the 7D sizing flow to build on.
- `src/components/LibraryIoPanel.tsx` / `FixtureEditor.tsx` — download helper to
  mirror.

## Acceptance criteria

- `npm run build` and `npm test` pass (≥ 418 + new 7E tests).
- BOM/procurement outputs carry the calculated requirement / recommended minimum
  / selected / verified distinction; unselected demands are marked PROCUREMENT
  REQUIRED; no fabricated parts for no-candidate demands.
- CSV/RFQ export works; no engineering math in UI (Rules 2/7); no
  `src/calculations/` changes; `src/core/` changes additive and recorded.

## Definition of done

1. Code + tests within scope; `npm test` and `npm run build` green.
2. Decisions recorded in `DECISIONS.md`.
3. `status.json` and this file advanced to mark 7E DONE and **M7 complete**.
4. Single package-scoped commit.
