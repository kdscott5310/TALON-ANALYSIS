# Milestone 1 — Working Foundation

Read only the repository files needed to implement this milestone. Treat `PROJECT_SPEC.md`, `CALCULATION_SPEC.md`, and `ARCHITECTURE.md` as authoritative. Do not summarize them.

## Goal
Create a runnable React + TypeScript engineering application foundation with typed inputs, SI-unit handling, validation, and a usable system-layout screen.

## Implement now
- Vite React TypeScript project if not already present.
- Clean `src/` structure separating UI, domain models, units, validation, calculations, and tests.
- Typed models for site geometry, cable, trolley/payload, crane, anchors, brake, and environment.
- Internal SI units with explicit conversion functions for common US customary inputs.
- Input validation with actionable errors and warnings.
- Scenario state with one clearly labeled unverified example.
- Main page containing grouped input panels, results placeholder, warning panel, and responsive SVG side-view geometry.
- SVG must show launch anchor, elevated master ring/crane point, downhill anchor, cable legs, trolley, dimensions, and ground line.
- Persistent preliminary-design and professional-validation disclaimer.
- Vitest tests for units and validation.

## Do not implement yet
Cable-force equations, dynamics, advanced braking, optimization, PDF reports, procurement, authentication, or backend services.

## Required commands
`npm install`, `npm test`, and `npm run build` must succeed.

## Completion checklist
- App starts with `npm run dev`.
- Inputs update the SVG immediately.
- Invalid inputs cannot silently enter calculations.
- SI conversions have automated tests.
- No calculation logic is embedded in React components.
- `TASKLIST.md` and `CHANGELOG.md` updated.
- Commit the milestone before stopping.

Do not ask the user to repeat repository requirements. Record unresolved details as clearly labeled assumptions and continue.
