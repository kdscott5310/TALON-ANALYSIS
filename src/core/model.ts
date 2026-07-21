/**
 * Project model — Milestone 6.
 *
 * The `Project` aggregate is the reusable description of a cable-supported
 * test fixture, moving-trolley system, crane-supported fixture, or portable
 * test structure. It is pure data with no React and no solver logic (Rule 5),
 * and every engineering property carries provenance (Rules 2–3).
 *
 * Layering note: today the CUFTS solvers still consume the legacy `Scenario`
 * object, which the CUFTS template preserves inside `templateData`. That keeps
 * v1 results bit-identical (Rule: preserve existing functionality) while the
 * generalized topology is established alongside it. Later milestones move
 * solvers onto the generalized entities directly.
 */

import type { Scenario } from '../models/scenario';
import type { CoordinateSystem, ModelNode } from './geometry';
import type { Element, Material } from './elements';
import type { Quantity, VerificationState } from './provenance';

// ── components (catalog references; the library itself lands in M9) ───────

export type ComponentCategory =
  | 'cable'
  | 'rigging'
  | 'trolley'
  | 'brake'
  | 'crane'
  | 'anchor'
  | 'structural'
  | 'instrumentation';

export interface ComponentRef {
  id: string;
  category: ComponentCategory;
  name: string;
  manufacturer?: string;
  model?: string;
  /** Library revision this reference was taken from (M9). */
  libraryRevision?: string;
  /** Engineering properties, each provenance-carrying. */
  properties: Record<string, Quantity>;
  notes?: string;
}

// ── supports and constraints ─────────────────────────────────────────────

/** Translational degrees of freedom; rotations arrive with frame elements. */
export interface DofMask {
  x: boolean;
  y: boolean;
  z: boolean;
}

export type SupportKind = 'fixed' | 'pinned' | 'roller' | 'spring' | 'prescribed';

export interface Support {
  id: string;
  name?: string;
  nodeId: string;
  kind: SupportKind;
  /** Which translations are restrained. */
  restrained: DofMask;
  /** Spring stiffnesses per axis, N/m (kind = 'spring'). */
  stiffness?: { x?: Quantity; y?: Quantity; z?: Quantity };
  /** Prescribed displacement per axis, m (kind = 'prescribed'; support motion). */
  prescribedDisplacement?: { x?: Quantity; y?: Quantity; z?: Quantity };
  notes?: string;
}

export type ConstraintKind = 'equalDof' | 'nodeOnPath' | 'rigidOffset';

/** Kinematic relation between nodes (distinct from a boundary condition). */
export interface Constraint {
  id: string;
  name?: string;
  kind: ConstraintKind;
  nodeIds: string[];
  /** Element defining the path for 'nodeOnPath'. */
  pathElementId?: string;
  /** Normalized position along the path, 0..1, for 'nodeOnPath'. */
  pathParameter?: Quantity;
  notes?: string;
}

// ── loads and load cases ─────────────────────────────────────────────────

export type LoadKind =
  | 'pointForce'
  | 'gravity'
  | 'wind'
  | 'thermal'
  | 'pretension'
  | 'prescribedDisplacement'
  | 'brakeForce';

export interface Load {
  id: string;
  name?: string;
  kind: LoadKind;
  /** Node the load acts on (point loads). */
  nodeId?: string;
  /** Element the load acts on (thermal, pretension, distributed). */
  elementId?: string;
  /** Components in the global frame, N (or m for prescribed displacement). */
  components?: { x?: Quantity; y?: Quantity; z?: Quantity };
  /** Scalar magnitude for kinds that need one (e.g. temperature delta, K). */
  magnitude?: Quantity;
  notes?: string;
}

export interface LoadCaseFactor {
  loadId: string;
  factor: number;
}

export interface LoadCase {
  id: string;
  name: string;
  description?: string;
  factors: LoadCaseFactor[];
  notes?: string;
}

// ── moving bodies ────────────────────────────────────────────────────────

/**
 * A body that travels along a path element (the trolley and its payload).
 * Wheel inertia and pendulum parameters are carried now so M8 can consume
 * them without a schema change.
 */
export interface MovingBody {
  id: string;
  name: string;
  /** Element the body travels along. */
  pathElementId: string;
  /** Total moving mass, kg. */
  mass?: Quantity;
  /** Rotary inertia of wheels about their axles, kg*m^2 (M8). */
  wheelRotaryInertia?: Quantity;
  /** Effective rolling radius, m (M8). */
  wheelRadius?: Quantity;
  /** Rolling-resistance coefficient, dimensionless. */
  rollingResistance?: Quantity;
  /** Aerodynamic drag area Cd*A, m^2. */
  dragArea?: Quantity;
  /** Suspended payload mass, kg (pendulum bob, M8). */
  payloadMass?: Quantity;
  /** Payload suspension length below the body, m. */
  payloadDrop?: Quantity;
  /** Payload pendulum damping ratio, dimensionless (M8). */
  payloadDamping?: Quantity;
  /** Structural force rating of the body, N. Missing => check not evaluated. */
  structuralRating?: Quantity;
  notes?: string;
}

// ── analysis cases and results ───────────────────────────────────────────

export type AnalysisKind =
  | 'staticCable'
  | 'staticSweep'
  | 'dynamicRun'
  | 'nonlinearCable'
  | 'coupledDynamics';

/** Solver identifier plus the settings that make a run reproducible (Rule 8). */
export interface AnalysisCase {
  id: string;
  name: string;
  kind: AnalysisKind;
  /** Which solver implementation to use, e.g. 'parabolic', 'catenary'. */
  solverId: string;
  loadCaseId?: string;
  movingBodyId?: string;
  /** Solver settings (tolerances, step size, element counts, …). */
  settings: Record<string, number | string | boolean>;
  notes?: string;
}

export type ConvergenceStatus = 'converged' | 'not-converged' | 'not-applicable' | 'failed';

/**
 * Result envelope. Rule 4 requires solvers to expose assumptions, units,
 * intermediate values, residuals, convergence status, and applicability
 * limits — so those are structural fields, not optional commentary.
 */
export interface SolverResult {
  id: string;
  analysisCaseId: string;
  solverId: string;
  /** ISO-8601 timestamp of the run. */
  ranOn: string;
  convergence: ConvergenceStatus;
  iterations?: number;
  /** Residual norms keyed by kind, e.g. { force: 1e-9, length: 2e-8 }. */
  residuals?: Record<string, number>;
  /** Primary outputs, each provenance-carrying (state 'estimated' for computed). */
  outputs: Record<string, Quantity>;
  /** Intermediate values retained for traceability. */
  intermediates?: Record<string, Quantity>;
  assumptions: string[];
  /** Conditions under which this result is valid. */
  applicabilityLimits: string[];
  warnings: string[];
  /** Worst provenance across the inputs this result depended on. */
  inputVerification: VerificationState;
}

// ── verification metadata ────────────────────────────────────────────────

export interface VerificationMetadata {
  /** Worst state across all project inputs — drives the headline data status. */
  overallState: VerificationState;
  /** Human summary of what still requires verification. */
  outstanding: string[];
  /** Set true only when a qualified engineer has signed the project off. */
  engineerReviewed: boolean;
  reviewedBy?: string;
  reviewedOn?: string;
}

// ── templates ────────────────────────────────────────────────────────────

export type TemplateId = 'cufts' | 'generic';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  /** Schema version of the template-specific payload in `templateData`. */
  dataVersion: number;
}

/**
 * Template-specific payload. For CUFTS this holds the legacy `Scenario`, which
 * remains the authoritative input for the v1 solvers reached via the adapter.
 */
export interface TemplateData {
  cufts?: Scenario;
}

// ── project aggregate ────────────────────────────────────────────────────

export const PROJECT_SCHEMA_VERSION = 1;

export interface Project {
  /** Version of the PROJECT envelope (independent of the CUFTS Scenario version). */
  schemaVersion: number;
  id: string;
  name: string;
  description?: string;
  /** ISO-8601. */
  createdOn: string;
  revision: string;
  template: TemplateInfo;
  templateData: TemplateData;

  coordinateSystems: CoordinateSystem[];
  nodes: ModelNode[];
  materials: Material[];
  components: ComponentRef[];
  elements: Element[];
  supports: Support[];
  constraints: Constraint[];
  loads: Load[];
  loadCases: LoadCase[];
  movingBodies: MovingBody[];
  analysisCases: AnalysisCase[];
  results: SolverResult[];
  verification: VerificationMetadata;
}

// ── referential integrity ────────────────────────────────────────────────

export interface IntegrityIssue {
  severity: 'error' | 'warning';
  entity: string;
  message: string;
}

/**
 * Checks that every cross-reference in the project resolves. Returns issues
 * rather than throwing so callers can surface them in the UI (Rule 4).
 */
export function checkProjectIntegrity(project: Project): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const nodeIds = new Set(project.nodes.map((n) => n.id));
  const csIds = new Set(project.coordinateSystems.map((c) => c.id));
  const elementIds = new Set(project.elements.map((e) => e.id));
  const materialIds = new Set(project.materials.map((m) => m.id));
  const loadIds = new Set(project.loads.map((l) => l.id));
  const componentIds = new Set(project.components.map((c) => c.id));

  const err = (entity: string, message: string) =>
    issues.push({ severity: 'error', entity, message });

  for (const node of project.nodes) {
    if (!csIds.has(node.csId)) err(`node:${node.id}`, `unknown coordinate system "${node.csId}"`);
  }
  for (const element of project.elements) {
    for (const nid of element.nodeIds) {
      if (!nodeIds.has(nid)) err(`element:${element.id}`, `unknown node "${nid}"`);
    }
    if (element.materialId && !materialIds.has(element.materialId)) {
      err(`element:${element.id}`, `unknown material "${element.materialId}"`);
    }
    if (element.componentId && !componentIds.has(element.componentId)) {
      err(`element:${element.id}`, `unknown component "${element.componentId}"`);
    }
  }
  for (const support of project.supports) {
    if (!nodeIds.has(support.nodeId)) err(`support:${support.id}`, `unknown node "${support.nodeId}"`);
  }
  for (const constraint of project.constraints) {
    for (const nid of constraint.nodeIds) {
      if (!nodeIds.has(nid)) err(`constraint:${constraint.id}`, `unknown node "${nid}"`);
    }
    if (constraint.pathElementId && !elementIds.has(constraint.pathElementId)) {
      err(`constraint:${constraint.id}`, `unknown path element "${constraint.pathElementId}"`);
    }
  }
  for (const load of project.loads) {
    if (load.nodeId && !nodeIds.has(load.nodeId)) err(`load:${load.id}`, `unknown node "${load.nodeId}"`);
    if (load.elementId && !elementIds.has(load.elementId)) {
      err(`load:${load.id}`, `unknown element "${load.elementId}"`);
    }
  }
  for (const lc of project.loadCases) {
    for (const f of lc.factors) {
      if (!loadIds.has(f.loadId)) err(`loadCase:${lc.id}`, `unknown load "${f.loadId}"`);
    }
  }
  for (const body of project.movingBodies) {
    if (!elementIds.has(body.pathElementId)) {
      err(`movingBody:${body.id}`, `unknown path element "${body.pathElementId}"`);
    }
  }
  for (const ac of project.analysisCases) {
    if (ac.loadCaseId && !project.loadCases.some((l) => l.id === ac.loadCaseId)) {
      err(`analysisCase:${ac.id}`, `unknown load case "${ac.loadCaseId}"`);
    }
    if (ac.movingBodyId && !project.movingBodies.some((b) => b.id === ac.movingBodyId)) {
      err(`analysisCase:${ac.id}`, `unknown moving body "${ac.movingBodyId}"`);
    }
  }
  return issues;
}
