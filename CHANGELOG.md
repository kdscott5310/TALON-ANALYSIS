# CHANGELOG

## v0.2.0 — Milestone 1: Working Foundation
- Added Vite + React 18 + TypeScript application scaffold (`package.json`, `vite.config.ts`, `tsconfig*`, `index.html`).
- Added SI-internal unit conversion module with exact NIST factors and display formatters (`src/units/units.ts`).
- Added typed domain models for site, cable, trolley, crane, anchors, brake, and environment (`src/models/scenario.ts`).
- Added clearly labeled unverified baseline example scenario mirroring PROJECT_SPEC Section 17 (`src/models/exampleScenario.ts`).
- Added scenario validation with blocking errors and advisory warnings (`src/validation/validate.ts`).
- Added nominal layout geometry helpers — chords/angles only, no cable-force equations (`src/calculations/layoutGeometry.ts`).
- Added Zustand app store with unit-system toggle (`src/state/store.ts`).
- Added UI: grouped input panel with unit-boundary conversion, responsive SVG side view (anchors, master node, crane, trolley, payload, brake/capture zones, dimensions), results placeholder, warnings panel, persistent validation disclaimer.
- Added 28 Vitest tests covering unit conversions (with hand-calculation benchmarks), validation error/warning behavior, and layout geometry.
- Fixed kg/m → lb/ft inverse conversion bug caught by round-trip test.

## v0.1.0
- Repository initialized.
- Documentation structure created.
