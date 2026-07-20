# Milestone 4 — Engineering Workflow, Scenarios, and Reports

Continue from completed Milestones 1–3. Preserve solver behavior and tests. Do not spend the session redesigning working calculations.

## Goal
Turn the validated solvers into an efficient preliminary-design workflow suitable for engineering reviews and comparing test configurations.

## Implement now
- Scenario create, duplicate, rename, delete, import, and export using versioned JSON.
- Local browser persistence with schema migration and recovery from invalid saved data.
- Comparison view for selected scenarios showing key geometry, loads, margins, speed, braking, and warnings.
- Organized workflow/navigation for Setup, Static Analysis, Dynamic Analysis, Results, and Report.
- Assumptions and unresolved-input register visible in the interface.
- Results traceability: each displayed result identifies units, source inputs, solver/model used, and applicable assumptions.
- Printable engineering report page with project metadata, input tables, assumptions, diagrams, plots, key results, warnings, and validation disclaimer.
- Browser print/PDF support; do not require a server.
- CSV export for summary results and dynamic time histories.
- Clear status categories: acceptable preliminary margin, caution, failed check, insufficient information, and solver error.
- Accessibility improvements, keyboard navigation, responsive layouts, and useful empty/error states.
- Tests for scenario serialization, schema migration, comparison calculations, and report data assembly.

## Scope control
Do not add authentication, cloud databases, purchasing links, certified crane charts, or controls that operate physical equipment.

## Completion checklist
- A user can configure, analyze, save, reload, compare, and report multiple scenarios without editing code.
- Imported files are validated before use.
- Reports clearly state that results require professional verification.
- No report displays missing information as zero or acceptable.
- `npm test` and `npm run build` pass.
- `TASKLIST.md` and `CHANGELOG.md` updated.
- Commit the milestone before stopping.
