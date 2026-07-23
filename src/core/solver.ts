/**
 * Solver contracts, fidelity levels, and the applicability engine — Milestone 6.
 *
 * Governance Rule 6: every calculated result must identify its solver, solver
 * version, fidelity level, units, coordinate system, assumptions, input
 * sources, verification status, convergence status, applicability status, and
 * unresolved limitations. That list is expressed here as required fields, so a
 * result that omits any of them cannot be constructed.
 *
 * Governance Rule 2: a result is only `acceptable` when data is present, the
 * solver converged, the model is inside its applicability range, ratings are
 * known, no demand exceeds a rating, and no critical risk is unresolved.
 * `overallAcceptance()` is the single place that decision is made.
 */

import type { Dimension } from './dimensions';
import type { InputConfidence, Quantity, VerificationState } from './provenance';
import type { FrameVector } from './coordinates';

// ── fidelity ─────────────────────────────────────────────────────────────

/**
 * LEVEL 0 — screening: conservative closed-form feasibility checks.
 * LEVEL 1 — preliminary design: simplified models (TALON v1 solvers).
 * LEVEL 2 — advanced preliminary: numerical / coupled models.
 * LEVEL 3 — external validated: an external solver result actually imported.
 */
export type FidelityLevel = 0 | 1 | 2 | 3;

export const FIDELITY_LABEL: Record<FidelityLevel, string> = {
  0: 'Level 0 — Screening',
  1: 'Level 1 — Preliminary Design',
  2: 'Level 2 — Advanced Preliminary',
  3: 'Level 3 — External Validated Analysis',
};

/**
 * Level 3 may only be claimed when an external solver result has actually been
 * imported and identified. Guarded here so no solver can self-declare it.
 */
export function assertFidelityClaim(
  level: FidelityLevel,
  externalResultImported: boolean,
): void {
  if (level === 3 && !externalResultImported) {
    throw new Error(
      'Level 3 (External Validated Analysis) cannot be claimed without an imported, ' +
        'identified external solver result (governance: fidelity levels).',
    );
  }
}

// ── validation status of the solver itself ───────────────────────────────

export type SolverValidation =
  | 'benchmarkVerified'
  | 'benchmarkPartial'
  | 'unvalidated'
  | 'externalValidated';

export const VALIDATION_LABEL: Record<SolverValidation, string> = {
  benchmarkVerified: 'Benchmark verified',
  benchmarkPartial: 'Partially benchmarked',
  unvalidated: 'Not yet benchmarked',
  externalValidated: 'Validated against external solver',
};

/** Identity and capability of a solver implementation. */
export interface SolverDescriptor {
  id: string;
  name: string;
  /** Semantic version of the solver implementation, bumped on numeric change. */
  version: string;
  fidelity: FidelityLevel;
  validation: SolverValidation;
  /** Model family, e.g. 'cable-static', 'trolley-dynamics'. */
  category: string;
  /** Conditions under which this solver is appropriate. */
  applicabilityNotes: string[];
  /** Reduced-order / lumped-parameter models must say so (Rule 11). */
  reducedOrder: boolean;
  description?: string;
}

// ── convergence and applicability ────────────────────────────────────────

export type ConvergenceStatus =
  | 'converged'
  | 'notConverged'
  | 'notApplicable'
  | 'diverged'
  | 'failed';

/** Result classification required by the applicability engine. */
export type ApplicabilityStatus =
  | 'validWithinLimits'
  | 'validWithCaution'
  | 'outsideRecommended'
  | 'insufficientInformation'
  | 'physicallyInfeasible'
  | 'didNotConverge'
  | 'invalidInput';

export const APPLICABILITY_LABEL: Record<ApplicabilityStatus, string> = {
  validWithinLimits: 'Within limits',
  validWithCaution: 'Valid with caution',
  outsideRecommended: 'Outside recommended applicability',
  insufficientInformation: 'Insufficient information',
  physicallyInfeasible: 'Physically infeasible',
  didNotConverge: 'Solver did not converge',
  invalidInput: 'Invalid input',
};

/** Ranked best → worst; used to reduce many checks to one status. */
const APPLICABILITY_RANK: Record<ApplicabilityStatus, number> = {
  validWithinLimits: 0,
  validWithCaution: 1,
  outsideRecommended: 2,
  insufficientInformation: 3,
  didNotConverge: 4,
  physicallyInfeasible: 5,
  invalidInput: 6,
};

/** A single applicability check evaluated before or after a solve. */
export interface ApplicabilityCheck {
  id: string;
  label: string;
  status: ApplicabilityStatus;
  /** What was measured, e.g. sag/span ratio. */
  measured?: number;
  /** Limit it was compared against. */
  limit?: number;
  detail: string;
}

/** Worst status across a set of checks. */
export function combineApplicability(checks: readonly ApplicabilityCheck[]): ApplicabilityStatus {
  let worst: ApplicabilityStatus = 'validWithinLimits';
  for (const c of checks) {
    if (APPLICABILITY_RANK[c.status] > APPLICABILITY_RANK[worst]) worst = c.status;
  }
  return worst;
}

// ── acceptance (Rule 2) ──────────────────────────────────────────────────

export type Acceptance =
  | 'acceptablePreliminary'
  | 'caution'
  | 'notAcceptable'
  | 'insufficientInformation';

export const ACCEPTANCE_LABEL: Record<Acceptance, string> = {
  acceptablePreliminary: 'Acceptable (preliminary)',
  caution: 'Caution',
  notAcceptable: 'NOT ACCEPTABLE',
  insufficientInformation: 'Insufficient information',
};

export interface AcceptanceInputs {
  convergence: ConvergenceStatus;
  applicability: ApplicabilityStatus;
  inputConfidence: InputConfidence;
  /** True when any calculated demand exceeds a known rating. */
  anyDemandExceedsRating: boolean;
  /** True when any required rating is unknown. */
  anyRequiredRatingUnknown: boolean;
  /** True when a critical risk is open (M14 hazard register). */
  anyCriticalRiskOpen: boolean;
}

/**
 * The single decision point for "is this result acceptable?" (Rule 2).
 * A result is never acceptable when data is missing, the solver failed, the
 * model is out of range, a rating is unknown, a demand exceeds a rating, or a
 * critical risk is open.
 */
export function overallAcceptance(i: AcceptanceInputs): Acceptance {
  if (
    i.applicability === 'invalidInput' ||
    i.applicability === 'physicallyInfeasible' ||
    i.convergence === 'failed' ||
    i.convergence === 'diverged'
  ) {
    return 'notAcceptable';
  }
  if (i.anyDemandExceedsRating) return 'notAcceptable';
  if (i.convergence === 'notConverged' || i.applicability === 'didNotConverge') {
    return 'notAcceptable';
  }
  if (
    i.applicability === 'insufficientInformation' ||
    i.inputConfidence === 'insufficient' ||
    i.anyRequiredRatingUnknown
  ) {
    return 'insufficientInformation';
  }
  if (i.anyCriticalRiskOpen) return 'notAcceptable';
  if (i.applicability === 'outsideRecommended') return 'notAcceptable';
  if (i.applicability === 'validWithCaution' || i.inputConfidence !== 'verified') {
    return 'caution';
  }
  return 'acceptablePreliminary';
}

// ── result badge (Rule 6) ────────────────────────────────────────────────

/** The badge shown on every result panel and report. */
export interface ResultBadge {
  analysisLevel: string;
  solver: string;
  solverVersion: string;
  validation: string;
  inputConfidence: InputConfidence;
  applicability: string;
  acceptance: string;
  /** Always "Not certified" — TALON never certifies (Rule 1). */
  certificationStatus: 'Not certified';
  reducedOrder: boolean;
}

export function buildResultBadge(
  descriptor: SolverDescriptor,
  applicability: ApplicabilityStatus,
  inputConfidence: InputConfidence,
  acceptance: Acceptance,
): ResultBadge {
  return {
    analysisLevel: FIDELITY_LABEL[descriptor.fidelity],
    solver: descriptor.name,
    solverVersion: descriptor.version,
    validation: VALIDATION_LABEL[descriptor.validation],
    inputConfidence,
    applicability: APPLICABILITY_LABEL[applicability],
    acceptance: ACCEPTANCE_LABEL[acceptance],
    certificationStatus: 'Not certified',
    reducedOrder: descriptor.reducedOrder,
  };
}

// ── solver output contract ───────────────────────────────────────────────

/** A named scalar output with dimension, units and provenance. */
export interface ScalarOutput {
  key: string;
  label: string;
  quantity: Quantity<Dimension>;
}

/** A named vector output that states its coordinate system (Rule 6). */
export interface VectorOutput {
  key: string;
  label: string;
  vector: FrameVector;
}

/**
 * The complete result envelope. Every field required by Rule 6 is mandatory,
 * so an incomplete result is a compile error rather than a silent omission.
 */
export interface SolverOutput {
  descriptor: SolverDescriptor;
  /** ISO-8601 time of the solve. */
  computedOn: string;
  /** Frame that unqualified vector results are expressed in. */
  primaryFrameId: string;
  convergence: ConvergenceStatus;
  iterations?: number;
  /** Residual norms by kind, e.g. { force: 1e-9, compatibility: 2e-8 }. */
  residuals: Record<string, number>;
  scalars: ScalarOutput[];
  vectors: VectorOutput[];
  /** Retained intermediates for traceability. */
  intermediates: ScalarOutput[];
  assumptions: string[];
  applicabilityChecks: ApplicabilityCheck[];
  applicability: ApplicabilityStatus;
  /** Worst verification state across the inputs this result depended on. */
  inputVerification: VerificationState;
  inputConfidence: InputConfidence;
  acceptance: Acceptance;
  /** Known limitations that remain unresolved for this result. */
  unresolvedLimitations: string[];
  warnings: string[];
  badge: ResultBadge;
}

/** A solver implementation: pure, deterministic, React-free (Rules 7 and 9). */
export interface Solver<TInput> {
  readonly descriptor: SolverDescriptor;
  /** Checks applicability before solving; may short-circuit the run. */
  preCheck(input: TInput): ApplicabilityCheck[];
  run(input: TInput): SolverOutput;
}

// ── registry ─────────────────────────────────────────────────────────────

const registry = new Map<string, SolverDescriptor>();

export function registerSolver(descriptor: SolverDescriptor): void {
  const key = `${descriptor.id}@${descriptor.version}`;
  if (registry.has(key)) {
    throw new Error(`Solver "${key}" is already registered.`);
  }
  registry.set(key, descriptor);
}

export function listSolvers(): SolverDescriptor[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function findSolver(id: string, version?: string): SolverDescriptor | undefined {
  if (version) return registry.get(`${id}@${version}`);
  return [...registry.values()].find((d) => d.id === id);
}

/** Clears the registry. Test-support only. */
export function resetSolverRegistry(): void {
  registry.clear();
}

// ── descriptors for the existing, validated v1 solvers ───────────────────

export const PARABOLIC_STATIC_V1: SolverDescriptor = {
  id: 'cufts-parabolic-static',
  name: 'Parabolic cable + master-node equilibrium',
  version: '1.0.0',
  fidelity: 1,
  validation: 'benchmarkVerified',
  category: 'cable-static',
  reducedOrder: true,
  applicabilityNotes: [
    'Sag/span below ~8%.',
    'Chord slope below ~30°.',
    'Elastic elongation neglected; horizontal tension fixed at pretension.',
  ],
  description:
    'TALON v1 static solver: parabolic cable per leg, master-ring vector equilibrium, ' +
    'anchor sliding/uplift checks, swept over trolley position.',
};

export const RK4_TROLLEY_V1: SolverDescriptor = {
  id: 'cufts-rk4-trolley',
  name: 'RK4 path-following trolley dynamics',
  version: '1.0.0',
  fidelity: 1,
  validation: 'benchmarkVerified',
  category: 'trolley-dynamics',
  reducedOrder: true,
  applicabilityNotes: [
    'Point-mass trolley; payload pendulum and wheel inertia not modeled.',
    'Quasi-static cable: the path is fixed during a run.',
    'Idealized brake laws; measured hardware curves arrive in Milestone 10.',
  ],
  description:
    'TALON v1 dynamics solver: RK4 integration along the solved cable path with ' +
    'gravity, rolling resistance, aerodynamic drag, wind, and selectable brake laws.',
};

/** Elastic catenary — the first Level-2 (advanced preliminary) solver (M8). */
export const ELASTIC_CATENARY_V1: SolverDescriptor = {
  id: 'cable-elastic-catenary',
  name: 'Elastic catenary cable',
  version: '1.0.0',
  fidelity: 2,
  validation: 'benchmarkVerified',
  category: 'cable-static',
  reducedOrder: true,
  applicabilityNotes: [
    'Perfectly flexible, linear-elastic (constant EA) cable; no material nonlinearity.',
    'Static planar equilibrium; out-of-plane load is the Milestone 11 model.',
    'Temperature and creep applied as an effective unstretched-length change.',
    'Tension-only: a near-zero minimum tension is reported as slack, not accepted.',
  ],
  description:
    'Exact elastic-catenary equations solved by Newton iteration on the end-force ' +
    'components, reporting convergence, residuals, tension and strain distribution, ' +
    'and a comparison against the parabolic model.',
};

/** Damped payload pendulum — longitudinal + lateral swing (M9). */
export const PAYLOAD_PENDULUM_V1: SolverDescriptor = {
  id: 'payload-pendulum',
  name: 'Damped payload pendulum',
  version: '1.0.0',
  fidelity: 2,
  validation: 'benchmarkVerified',
  category: 'payload-dynamics',
  reducedOrder: true,
  applicabilityNotes: [
    'Point-mass payload on a massless rigid link of fixed length.',
    'Longitudinal and lateral modes decoupled; no feedback into the cable.',
    'Reaction estimate is quasi-static and conservative beyond ~20° swing.',
  ],
  description:
    'RK4-integrated damped pendulum forced by trolley acceleration/braking ' +
    '(longitudinal) and crosswind drag (lateral).',
};

/** Lateral / out-of-plane cable dynamics — reduced-order lumped mass (M11). */
export const LATERAL_CABLE_V1: SolverDescriptor = {
  id: 'lateral-cable-dynamics',
  name: 'Lateral cable dynamics (lumped mass)',
  version: '1.0.0',
  fidelity: 2,
  validation: 'benchmarkVerified',
  category: 'cable-dynamics',
  reducedOrder: true,
  applicabilityNotes: [
    'Transverse (out-of-plane) motion only; axial tension held at its static value.',
    'Linear geometric stiffness (small lateral slope).',
    'Reduced-order lumped-mass string — NOT finite-element analysis.',
  ],
  description:
    'Tensioned-string lumped-mass model for out-of-plane sway, support side-load, ' +
    'dominant frequency, and dynamic amplification under wind, gust, and brake impulse.',
};

/** Registers the built-in solver descriptors (idempotent per registry reset). */
export function registerBuiltInSolvers(): void {
  for (const d of [
    PARABOLIC_STATIC_V1,
    RK4_TROLLEY_V1,
    ELASTIC_CATENARY_V1,
    PAYLOAD_PENDULUM_V1,
    LATERAL_CABLE_V1,
  ]) {
    if (!findSolver(d.id, d.version)) registerSolver(d);
  }
}
