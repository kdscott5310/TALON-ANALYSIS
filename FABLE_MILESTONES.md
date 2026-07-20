# Fable 5 Milestone Runner

Use one milestone prompt per Fable 5 session. Do not load later milestone prompts until the current milestone is complete.

Order:
1. `prompts/MILESTONE_01_FOUNDATION.md`
2. `prompts/MILESTONE_02_STATIC_ENGINEERING.md`
3. `prompts/MILESTONE_03_DYNAMICS_AND_BRAKING.md`
4. `prompts/MILESTONE_04_UI_REPORTS_AND_SCENARIOS.md`
5. `prompts/MILESTONE_05_VALIDATION_AND_RELEASE.md`

For every session, paste only:

> Open `kdscott5310/TALON-ANALYSIS`. Read and execute `prompts/MILESTONE_0X_....md`. Do not restate requirements or stop at planning. Modify code immediately, run tests and build, fix failures, update `TASKLIST.md` and `CHANGELOG.md`, and commit the completed milestone before stopping.

Do not begin the next milestone until the previous milestone builds, tests pass, and its acceptance checklist is satisfied.
