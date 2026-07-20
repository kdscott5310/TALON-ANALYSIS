# Milestone 5 — Validation, Hardening, and Release

Continue from completed Milestones 1–4. This milestone is for verification and release readiness, not uncontrolled feature expansion.

## Goal
Audit the entire application against the repository requirements, strengthen numerical confidence, remove defects, and produce a deployable preliminary-design release.

## Implement now
- Requirements traceability matrix linking specification items to code, tests, UI, and remaining gaps.
- Independent benchmark and regression tests for units, geometry, static equilibrium, anchors, dynamics, braking, serialization, and report assembly.
- Property/invariant tests where practical: dimensional consistency, reaction equilibrium, nonnegative energy, monotonic brake-work behavior, and finite outputs.
- Edge cases for near-level cables, steep geometry, small sag, large loads, zero wind, opposing wind, short brake zones, and invalid ratings.
- Numerical tolerance and time-step sensitivity documentation.
- Application-wide error boundary and useful diagnostic messages.
- Performance review so normal scenarios calculate interactively without freezing the UI.
- Security/dependency audit and removal of unused packages, secrets, generated junk, and test write files.
- Production build configuration and deployment instructions for a static host.
- Final README with setup, use, limitations, model descriptions, verification status, and screenshot placeholders if images are unavailable.
- Release notes and explicit list of calculations or inputs still requiring licensed-professional/manufacturer validation.

## Optional only after required work passes
Add an elastic-catenary solver as an experimental comparison model only if it can be tested, clearly labeled, and does not weaken the release. Do not add an unverified complex solver merely to claim feature completeness.

## Release gates
- Every requirement is marked implemented, partially implemented, deferred, or not applicable.
- No known critical calculation defect remains hidden.
- All assumptions, limitations, and solver failures are visible to the user.
- No manufacturer or crane capacity data is represented as certified unless entered and verified by the user.
- `npm test` and `npm run build` pass from a clean checkout.
- `TASKLIST.md`, `CHANGELOG.md`, README, and traceability documentation updated.
- Create a final release commit before stopping.

Return only a concise completion report listing commit, tests/build status, implemented items, and unresolved validation items. Do not restate the full project specification.
