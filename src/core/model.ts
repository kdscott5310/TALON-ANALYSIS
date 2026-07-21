/**
 * Project model — Milestone 6.
 *
 * The `Project` aggregate describes a mechanical or cable-supported test
 * fixture independently of any single application. Pure data: no React
 * (Rule 7), SI internally (Rule 8), every engineering property carrying
 * provenance (Rules 3–5).
 *
 * Layering note: the v1 CUFTS solvers still consume the legacy `Scenario`,
 * which the CUFTS template preserves in `templateData`. That keeps v1 results
 * bit-identical while the generalized topology is established alongside.
 * Later milestones move solvers onto the generalized entities directly.
 */

import type { Scenario } from '../models/scenario';
import type { CoordinateSystem, ModelNode } from './coordinates';
import type { Element, Material } from './elements';
import type { Quantity, VerificationState } from './provenance';
import type { AnalysisRun } from './analysisRun';
import type { FidelityLevel } from './solver';
import type { FixtureTemplateId } from './templates/registry';

// ── identity ─────────────────────────────────────────────────────────────

export interface ProjectIdentity {
  projectNumber?: string;
  customer?: string;
  testProgram?: string;
  engineer?: string;
  organization?: string;
  site?: string;
  notes?: string;
}

// ── components (library lands in M7; this is the in-project reference) ────

export type ComponentCategory =
  | 'wireRope'
  | 'syntheticRope'
  | 'cable'
  | 'chain'
  | 'shackle'
  | 'masterLink'
  | 'deltaRing'
  | 'turnbuckle'
  | 'loadCell'
  | 'dynamometer'
  | 'sheave'
  | 'snatchBlock'
  | 'pulley'
  | 'bearing'
  | 'wheel'
  | 'trolleyFrame'
  | 'brake'
  | 'hydraulicCylinder'
  | 'accumulator'
  | 'shockAbsorber'
  | 'winch'
  | 'crane'
  | 'portableMast'
  | 'ecologyBlock'
  | 'ballast'
  | 'groundAnchor'
  | 'structuralSteel'
  | 'aluminum'
  | 'fastener'
  | 'sensor'
  | 'camera'
  | 'encoder'
  | 'dataAcquisition'
  | 'controller'
  | 'safetyDevice';

export interface ComponentRef {
  id: string;
  category: ComponentCategory;
  name: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  /** Library revision this reference was taken from (M7). */
  libraryRevision?: string;
  /** Engineering properties, each provenance-carrying. */
  properties: Record<string, Quantity>;
  notes?: string;
}

// ── supports and constraints ─────────────────────────────────────────────

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
  restrained: DofMask;
  /** Frame the restraint directions are expressed in. */
  csId?: string;
  stiffness?: { x?: Quantity<'stiffness'>; y?: Quantity<'stiffness'>; z?: Quantity<'stiffness'> };
  prescribedDisplacement?: {
    x?: Quantity<'length'>;
    y?: Quantity<'length'>;
    z?: Quantity<'length'>;
  };
  notes?: string;
}

export type ConstraintKind = 'equalDof' | 'nodeOnPath' | 'rigidOffset';

export interface Constraint {
  id: string;
  name?: string;
  kind: ConstraintKind;
  nodeIds: string[];
  pathElementId?: string;
  /** Normalized position along the path, 0..1. */
  pathParameter?: Quantity<'dimensionless'>;
  notes?: string;
}

// ── loads, load cases, load combinations ─────────────────────────────────

export type LoadKind =
  | 'pointForce'
  | 'gravity'
  | 'wind'
  | 'gust'
  | 'thermal'
  | 'pretension'
  | 'prescribedDisplacement'
  | 'brakeForce'
  | 'impulse';

export interface Load {
  id: string;
  name?: string;
  kind: LoadKind;
  nodeId?: string;
  elementId?: string;
  /** Frame the components are expressed in (Rule 6). */
  csId?: string;
  components?: { x?: Quantity; y?: Quantity; z?: Quantity };
  magnitude?: Quantity;
  notes?: string;
}

/** Named operating conditions reused across projects (M12 expands the catalogue). */
export type LoadCaseKind =
  | 'dead'
  | 'pretension'
  | 'launch'
  | 'trolleyAtPosition'
  | 'normalOperation'
  | 'brakeEntry'
  | 'maximumBraking'
  | 'emergencyStop'
  | 'backupArrestor'
  | 'steadyWind'
  | 'gust'
  | 'crosswind'
  | 'supportMovement'
  | 'anchorDegradation'
  | 'componentFailure'
  | 'craneLowering'
  | 'setup'
  | 'recovery'
  | 'transportation'
  | 'custom';

export interface LoadCaseFactor {
  loadId: string;
  factor: number;
}

export interface LoadCase {
  id: string;
  name: string;
  kind: LoadCaseKind;
  description?: string;
  factors: LoadCaseFactor[];
  notes?: string;
}

/**
 * A user-defined combination of load cases.
 *
 * Building-code combinations are never hard-coded; `standard` is recorded only
 * when the user explicitly selects a standard and revision.
 */
export interface LoadCombination {
  id: string;
  name: string;
  terms: { loadCaseId: string; factor: number }[];
  /** Standard and revision, when the user selected one. Never assumed. */
  standard?: { name: string; revision: string };
  notes?: string;
}

// ── moving bodies ────────────────────────────────────────────────────────

export interface MovingBody {
  id: string;
  name: string;
  pathElementId: string;
  mass?: Quantity<'mass'>;
  /** Wheel rotary inertia about the axle, kg·m² (M9). */
  wheelRotaryInertia?: Quantity<'rotaryInertia'>;
  wheelRadius?: Quantity<'length'>;
  wheelCount?: Quantity<'dimensionless'>;
  rollingResistance?: Quantity<'dimensionless'>;
  bearingResistance?: Quantity<'dimensionless'>;
  dragArea?: Quantity<'area'>;
  payloadMass?: Quantity<'mass'>;
  payloadDrop?: Quantity<'length'>;
  payloadDamping?: Quantity<'dimensionless'>;
  /** Structural force rating, N. Missing => check not evaluated. */
  structuralRating?: Quantity<'force'>;
  maxSpeed?: Quantity<'velocity'>;
  notes?: string;
}

// ── analysis cases ───────────────────────────────────────────────────────

export type AnalysisKind =
  | 'staticCable'
  | 'staticSweep'
  | 'dynamicRun'
  | 'nonlinearCable'
  | 'coupledDynamics'
  | 'sensitivity'
  | 'optimization'
  | 'externalExport';

/** Solver selection plus the settings that make a run reproducible (Rule 9). */
export interface AnalysisCase {
  id: string;
  name: string;
  kind: AnalysisKind;
  solverId: string;
  solverVersion: string;
  /** Fidelity the user selected for this case. */
  fidelity: FidelityLevel;
  loadCaseId?: string;
  loadCombinationId?: string;
  movingBodyId?: string;
  settings: Record<string, number | string | boolean>;
  notes?: string;
}

// ── risks and assumptions ────────────────────────────────────────────────

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'mitigated' | 'accepted' | 'closed';

/** Hazard/FMEA entry. The full register arrives in M14. */
export interface RiskEntry {
  id: string;
  subsystem?: string;
  failureMode: string;
  cause?: string;
  systemEffect?: string;
  severity: RiskSeverity;
  status: RiskStatus;
  mitigation?: string;
  owner?: string;
  evidence?: string;
  /** True for seeded starter content requiring engineering review. */
  starterContent: boolean;
}

export interface AssumptionEntry {
  id: string;
  statement: string;
  rationale?: string;
  /** Verification state of the data or judgement behind the assumption. */
  state: VerificationState;
  /** What must happen to retire the assumption. */
  resolutionPath?: string;
}

// ── test data and reports (M16 / reporting) ──────────────────────────────

export interface TestDataRef {
  id: string;
  testNumber?: string;
  testArticle?: string;
  /** Original file name; raw data is never overwritten (M16). */
  rawFileName?: string;
  recordedOn?: string;
  channelMap?: Record<string, string>;
  notes?: string;
}

export interface ReportRef {
  id: string;
  title: string;
  revision: string;
  issuedOn?: string;
  /** Analysis runs this report was built from. */
  analysisRunIds: string[];
  notes?: string;
}

// ── bill of materials (M13) ──────────────────────────────────────────────

export interface BomLine {
  itemNumber: string;
  subsystem?: string;
  category?: ComponentCategory;
  quantity: number;
  description: string;
  componentId?: string;
  /** Calculated demand this line must satisfy. */
  requiredRating?: Quantity;
  selectedRating?: Quantity;
  designFactor?: Quantity<'dimensionless'>;
  utilization?: Quantity<'dimensionless'>;
  notes?: string;
}

// ── revision and review ──────────────────────────────────────────────────

export interface RevisionEntry {
  revision: string;
  changedOn: string;
  changedBy?: string;
  summary: string;
}

export type ReviewStatus = 'draft' | 'inReview' | 'engineerReviewed' | 'superseded';

export interface VerificationMetadata {
  /** Worst state across all project inputs — drives the headline data status. */
  overallState: VerificationState;
  outstanding: string[];
  reviewStatus: ReviewStatus;
  /** Set only by a qualified person; never by the software (Rule 1). */
  engineerReviewed: boolean;
  reviewedBy?: string;
  reviewedOn?: string;
}

// ── template payload ─────────────────────────────────────────────────────

export interface TemplateInfo {
  id: FixtureTemplateId;
  name: string;
  description: string;
  dataVersion: number;
}

/** Template-specific payload. CUFTS keeps the authoritative v1 `Scenario`. */
export interface TemplateData {
  cufts?: Scenario;
}

// ── project aggregate ────────────────────────────────────────────────────

export const PROJECT_SCHEMA_VERSION = 2;

export interface Project {
  /** Version of the PROJECT envelope (independent of the CUFTS Scenario version). */
  schemaVersion: number;
  id: string;
  name: string;
  description?: string;
  createdOn: string;
  revision: string;
  identity: ProjectIdentity;
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
  loadCombinations: LoadCombination[];
  movingBodies: MovingBody[];
  analysisCases: AnalysisCase[];
  /** Frozen historical runs. */
  analysisRuns: AnalysisRun[];
  risks: RiskEntry[];
  assumptions: AssumptionEntry[];
  testData: TestDataRef[];
  reports: ReportRef[];
  bom: BomLine[];
  revisions: RevisionEntry[];
  verification: VerificationMetadata;
}

// ── referential integrity ────────────────────────────────────────────────

export interface IntegrityIssue {
  severity: 'error' | 'warning';
  entity: string;
  message: string;
}

/**
 * Checks that every cross-reference resolves. Returns issues rather than
 * throwing so callers can surface them in the UI (Rule 6).
 */
export function checkProjectIntegrity(project: Project): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const nodeIds = new Set(project.nodes.map((n) => n.id));
  const csIds = new Set(project.coordinateSystems.map((c) => c.id));
  const elementIds = new Set(project.elements.map((e) => e.id));
  const materialIds = new Set(project.materials.map((m) => m.id));
  const loadIds = new Set(project.loads.map((l) => l.id));
  const loadCaseIds = new Set(project.loadCases.map((l) => l.id));
  const componentIds = new Set(project.components.map((c) => c.id));

  const err = (entity: string, message: string) =>
    issues.push({ severity: 'error', entity, message });

  for (const node of project.nodes) {
    if (!csIds.has(node.csId)) err(`node:${node.id}`, `unknown coordinate system "${node.csId}"`);
  }
  for (const cs of project.coordinateSystems) {
    if (cs.parentId && !csIds.has(cs.parentId)) {
      err(`coordinateSystem:${cs.id}`, `unknown parent "${cs.parentId}"`);
    }
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
    if (element.csId && !csIds.has(element.csId)) {
      err(`element:${element.id}`, `unknown coordinate system "${element.csId}"`);
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
  for (const combo of project.loadCombinations) {
    for (const t of combo.terms) {
      if (!loadCaseIds.has(t.loadCaseId)) {
        err(`loadCombination:${combo.id}`, `unknown load case "${t.loadCaseId}"`);
      }
    }
  }
  for (const body of project.movingBodies) {
    if (!elementIds.has(body.pathElementId)) {
      err(`movingBody:${body.id}`, `unknown path element "${body.pathElementId}"`);
    }
  }
  for (const ac of project.analysisCases) {
    if (ac.loadCaseId && !loadCaseIds.has(ac.loadCaseId)) {
      err(`analysisCase:${ac.id}`, `unknown load case "${ac.loadCaseId}"`);
    }
    if (ac.movingBodyId && !project.movingBodies.some((b) => b.id === ac.movingBodyId)) {
      err(`analysisCase:${ac.id}`, `unknown moving body "${ac.movingBodyId}"`);
    }
  }
  for (const report of project.reports) {
    for (const runId of report.analysisRunIds) {
      if (!project.analysisRuns.some((r) => r.id === runId)) {
        err(`report:${report.id}`, `unknown analysis run "${runId}"`);
      }
    }
  }
  return issues;
}

/** Ids of risks that are critical and still open (feeds Rule 2 acceptance). */
export function openCriticalRiskIds(project: Project): string[] {
  return project.risks
    .filter((r) => r.severity === 'critical' && (r.status === 'open' || r.status === 'mitigated'))
    .filter((r) => r.status === 'open')
    .map((r) => r.id);
}
