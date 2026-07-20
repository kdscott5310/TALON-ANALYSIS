# Fable 5 Execution Prompt

Open `kdscott5310/TALON-ANALYSIS` and build the first working version now.

Read only these files first:
1. `PROJECT_SPEC.md`
2. `CALCULATION_SPEC.md`
3. `ARCHITECTURE.md`

Do not spend a turn writing a long plan, repeating requirements, or asking for information already in the repo. Inspect the repo, then immediately create and commit working code.

Build one complete vertical slice using React, TypeScript, and Vite:
- application shell and input panel
- SI-based unit conversion
- typed geometry, cable, trolley, crane, anchor, and brake inputs
- parabolic static cable solver
- cable profile, sag, tension, end reactions, and clearance results
- master-ring vector/resultant and crane-capacity margin
- basic anchor sliding check
- brake kinetic-energy, stopping-force, and deceleration calculation
- SVG side-view diagram
- warnings/results panel
- clearly labeled unverified example scenario
- Vitest tests for each calculation

Rules:
- Keep engineering calculations outside React components.
- Use SI internally and convert at the UI boundary.
- Never invent certified vendor ratings.
- Show assumptions and warnings; never hide invalid inputs or solver failures.
- Clearly state that results require professional validation.
- Prefer working code over documentation.
- Do not implement catenary, segmented cable, advanced dynamics, reports, procurement, or Monte Carlo until this vertical slice builds and tests successfully.

Completion criteria:
```bash
npm install
npm test
npm run build
```
All must pass. Fix errors before stopping. Commit the finished vertical slice to the repository and summarize only the files changed, tests run, and remaining blockers.