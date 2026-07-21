/**
 * Project analysis adapter — Milestone 6.
 *
 * Runs the existing, benchmarked v1 solvers from a generalized `Project` by
 * extracting the CUFTS scenario the template preserves. The solvers themselves
 * are untouched, so results are bit-identical to v1 (see
 * `src/tests/generalizedModel.test.ts`, which asserts exact equality).
 *
 * Later milestones replace these adapters with solvers that consume the
 * generalized entities directly; the `AnalysisCase.solverId` field already
 * distinguishes 'parabolic-v1' / 'rk4-trolley-v1' from future implementations.
 */

import { runStaticAnalysis, type StaticAnalysisResult } from '../calculations/staticAnalysis';
import { runDynamicsAnalysis, type DynamicsAnalysisResult } from '../calculations/dynamicsAnalysis';
import { summarizeScenario, type ScenarioSummary } from '../calculations/statusSummary';
import type { Project } from './model';
import { extractScenario, isCuftsProject } from './templates/cufts';

/** Static analysis at a given trolley position, via the CUFTS adapter. */
export function analyzeProjectStatic(
  project: Project,
  trolleyPositionFrac: number,
): StaticAnalysisResult {
  requireCufts(project, 'static analysis');
  return runStaticAnalysis({ scenario: extractScenario(project), trolleyPositionFrac });
}

/** Time-domain dynamics run, via the CUFTS adapter. */
export function analyzeProjectDynamics(project: Project): DynamicsAnalysisResult {
  requireCufts(project, 'dynamic analysis');
  return runDynamicsAnalysis(extractScenario(project));
}

/** Five-category status summary, via the CUFTS adapter. */
export function summarizeProject(project: Project): ScenarioSummary {
  requireCufts(project, 'status summary');
  return summarizeScenario(extractScenario(project));
}

function requireCufts(project: Project, what: string): void {
  if (!isCuftsProject(project)) {
    throw new Error(
      `Cannot run ${what}: project "${project.id}" uses template "${project.template.id}", ` +
        "but only the 'cufts' template has solvers in this build.",
    );
  }
}
