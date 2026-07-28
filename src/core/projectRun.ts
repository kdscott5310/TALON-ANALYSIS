/**
 * Project analysis runs — Milestone 6G.
 *
 * Wraps the validated v1 CUFTS result (the five-category status summary) in the
 * solver-result contract (`core/solver.ts`) and freezes it as a reproducible
 * `AnalysisRun` (`core/analysisRun.ts`). It adds NO engineering math — it maps
 * an existing, benchmark-verified result into the badge/run envelope so the
 * editor can show fidelity, applicability, convergence, and certification
 * status honestly (Rules 1, 2, 6).
 *
 * Only CUFTS has solvers in this build; custom-project analysis is deferred to a
 * later package, so a custom project returns an explicit "no applicable solver"
 * result rather than a fabricated one (Rule 4).
 */
import type { Project } from './model';
import { openCriticalRiskIds } from './model';
import { GLOBAL_CS_ID } from './coordinates';
import { isCuftsProject, extractScenario } from './templates/cufts';
import { summarizeProject } from './projectAnalysis';
import { quantity, missing, isVerified, type InputConfidence, type VerificationState } from './provenance';
import type { Dimension } from './dimensions';
import type { CheckStatus, SummaryItem } from '../calculations/statusSummary';
import {
  PARABOLIC_STATIC_V1,
  buildResultBadge,
  combineApplicability,
  type Acceptance,
  type ApplicabilityCheck,
  type ApplicabilityStatus,
  type ConvergenceStatus,
  type ScalarOutput,
  type SolverOutput,
} from './solver';
import { createAnalysisRun, type AnalysisRun } from './analysisRun';

export type ProjectRunResult =
  | { ok: true; run: AnalysisRun }
  | { ok: false; reason: string };

export interface RunOptions {
  appVersion: string;
  author?: string;
  /** Injectable clock + id for deterministic/reproducible runs. */
  ranOn?: string;
  runId?: string;
}

function dimensionOf(kind: SummaryItem['kind']): Dimension {
  switch (kind) {
    case 'force':
      return 'force';
    case 'length':
      return 'length';
    case 'speed':
      return 'velocity';
    case 'angle':
      return 'angle';
    default:
      // ratio, g (g-multiple), sf (safety factor), text → unitless number
      return 'dimensionless';
  }
}

function acceptanceOf(overall: CheckStatus): Acceptance {
  switch (overall) {
    case 'ok':
      return 'acceptablePreliminary';
    case 'caution':
      return 'caution';
    case 'insufficient':
      return 'insufficientInformation';
    default:
      return 'notAcceptable'; // failed | error
  }
}

function applicabilityOf(status: CheckStatus): ApplicabilityStatus {
  switch (status) {
    case 'error':
      return 'invalidInput';
    case 'insufficient':
      return 'insufficientInformation';
    case 'caution':
      return 'validWithCaution';
    default:
      return 'validWithinLimits'; // ok | failed (a failed CHECK is an acceptance issue, not applicability)
  }
}

function confidenceOf(state: VerificationState): InputConfidence {
  if (state === 'missing') return 'insufficient';
  if (isVerified(state)) return 'verified';
  return 'unverified';
}

/** Runs the applicable analysis for a project and returns a frozen run, or a reason it cannot. */
export function runProjectAnalysis(project: Project, opts: RunOptions): ProjectRunResult {
  if (!isCuftsProject(project)) {
    return {
      ok: false,
      reason:
        `No analysis solver ships for the "${project.template.id}" template in this build. ` +
        'Analysis of custom node-and-element projects is deferred to a later work package; ' +
        'no result is fabricated for geometry the platform cannot yet solve.',
    };
  }

  const summary = summarizeProject(project);
  const inputState = project.verification.overallState;
  const convergence: ConvergenceStatus = summary.solverError ? 'failed' : 'converged';

  const scalars: ScalarOutput[] = summary.items
    .filter((i) => i.kind !== 'text')
    .map((i) => {
      const dim = dimensionOf(i.kind);
      return {
        key: i.key,
        label: i.label,
        // A not-evaluated check stays MISSING — never coerced to 0 (Rule 4).
        quantity:
          i.valueSI === null
            ? missing(dim, i.detail)
            : quantity(i.valueSI, dim, inputState, { notes: i.detail }),
      };
    });

  const applicabilityChecks: ApplicabilityCheck[] = summary.items.map((i) => ({
    id: i.key,
    label: i.label,
    status: applicabilityOf(i.status),
    detail: i.detail,
  }));
  const applicability = combineApplicability(applicabilityChecks);
  const acceptance = acceptanceOf(summary.overall);
  const inputConfidence = confidenceOf(inputState);

  const output: SolverOutput = {
    descriptor: PARABOLIC_STATIC_V1,
    computedOn: opts.ranOn ?? new Date().toISOString(),
    primaryFrameId: GLOBAL_CS_ID,
    convergence,
    residuals: {},
    scalars,
    vectors: [],
    intermediates: [],
    assumptions: [
      'Parabolic small-sag cable; horizontal tension fixed at pretension.',
      'Point-mass trolley; idealized brake law; quasi-static cable.',
      'Static + dynamic checks reduced to the v1 five-category status summary.',
    ],
    applicabilityChecks,
    applicability,
    inputVerification: inputState,
    inputConfidence,
    acceptance,
    unresolvedLimitations: project.verification.outstanding,
    warnings: summary.criticalWarnings,
    badge: buildResultBadge(PARABOLIC_STATIC_V1, applicability, inputConfidence, acceptance),
  };

  const scenario = extractScenario(project);
  const run = createAnalysisRun({
    id: opts.runId ?? `run-${project.id}-${output.computedOn}`,
    author: opts.author ?? 'editor',
    analysisCaseId: project.analysisCases[0]?.id ?? 'ac-adhoc',
    provenance: {
      projectRevision: project.revision,
      fixtureTemplateId: project.template.id,
      fixtureTemplateVersion: project.template.dataVersion,
      scenarioRevision: scenario.schemaVersion,
      modelSchemaVersion: project.schemaVersion,
      solverId: PARABOLIC_STATIC_V1.id,
      solverVersion: PARABOLIC_STATIC_V1.version,
      sourceCommit: null,
      componentLibraryRevision: null,
      appVersion: opts.appVersion,
    },
    inputSnapshot: { scenario, settings: {} },
    coordinateSystems: project.coordinateSystems,
    output,
    openRiskIds: openCriticalRiskIds(project),
    inputVerification: inputState,
    ranOn: opts.ranOn,
  });

  return { ok: true, run };
}
