/**
 * Custom node-and-element fixture template — Milestone 6D.
 *
 * Unlike CUFTS (whose geometry is projected from an authoritative v1 scenario
 * and re-derived on load), a custom project's nodes and elements ARE the
 * authoritative model. Nothing re-derives them, so graphical edits round-trip
 * losslessly through serialization. This is the seam that makes the fixture
 * editor's add/move/delete operations (6D) durable.
 *
 * Pure data: no React (Rule 7), no engineering math. Missing engineering
 * properties stay missing — this template ships geometry only, not ratings.
 */
import {
  GLOBAL_CS_ID,
  globalCoordinateSystem,
  vec3,
  type ModelNode,
} from '../coordinates';
import {
  PROJECT_SCHEMA_VERSION,
  type Project,
  type VerificationMetadata,
} from '../model';
import { getTemplateInfo, registerTemplateBuilder, type FixtureTemplateId } from './registry';

export const CUSTOM_TEMPLATE_ID: FixtureTemplateId = 'customNodeElement';

export interface CustomProjectOptions {
  id?: string;
  name?: string;
  createdOn?: string;
  revision?: string;
}

/**
 * Builds a minimal, valid custom project: a global frame and two starter nodes
 * the user can move, delete, or connect. It carries no engineering ratings, so
 * its data state is provisional (never certified) until the user supplies and
 * verifies real values.
 */
export function createCustomProject(options: CustomProjectOptions = {}): Project {
  const createdOn = options.createdOn ?? new Date().toISOString();
  const revision = options.revision ?? '1';

  const nodes: ModelNode[] = [
    { id: 'node-1', name: 'Node 1', csId: GLOBAL_CS_ID, position: vec3(0, 0, 0), role: 'generic' },
    { id: 'node-2', name: 'Node 2', csId: GLOBAL_CS_ID, position: vec3(10, 0, 0), role: 'generic' },
  ];

  const verification: VerificationMetadata = {
    overallState: 'provisional',
    outstanding: [
      'Custom model carries geometry only; component ratings and material ' +
        'properties must be entered and verified before any analysis is trusted.',
    ],
    reviewStatus: 'draft',
    engineerReviewed: false,
  };

  const info = getTemplateInfo(CUSTOM_TEMPLATE_ID)!;

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: options.id ?? 'project-custom',
    name: options.name ?? 'Custom project',
    description: 'Free-form node-and-element model. Geometry is authoritative and editable.',
    createdOn,
    revision,
    identity: { notes: 'Identity fields are user-supplied; none are inferred by the software.' },
    template: { id: CUSTOM_TEMPLATE_ID, name: info.name, description: info.description, dataVersion: info.dataVersion },
    templateData: {},
    coordinateSystems: [globalCoordinateSystem()],
    nodes,
    materials: [],
    components: [],
    elements: [],
    supports: [],
    constraints: [],
    loads: [],
    loadCases: [],
    loadCombinations: [],
    movingBodies: [],
    analysisCases: [],
    analysisRuns: [],
    risks: [],
    assumptions: [],
    testData: [],
    reports: [],
    bom: [],
    revisions: [{ revision, changedOn: createdOn, summary: 'Project created from the custom node-and-element template.' }],
    verification,
  };
}

/** True when a project's geometry is authoritative and freely editable (6D). */
export function isCustomProject(project: Project): boolean {
  return project.template.id === CUSTOM_TEMPLATE_ID;
}

// Register the custom builder. The template ignores the scenario argument that
// the CUFTS-oriented builder signature carries — a custom project is seeded
// from nothing, not from a v1 scenario.
registerTemplateBuilder(CUSTOM_TEMPLATE_ID, (_scenario, options) => createCustomProject(options));
