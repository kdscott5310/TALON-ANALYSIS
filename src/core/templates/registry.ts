/**
 * Fixture-template registry — Milestone 6.
 *
 * Fixtures are assemblies of reusable model entities, not bespoke solvers.
 * This registry declares the planned template catalogue and records, honestly,
 * which templates are actually implemented.
 *
 * Governance: a template that is not implemented cannot be instantiated —
 * `instantiateTemplate` throws rather than returning an empty or guessed
 * model. TALON must never imply a capability it does not have (Rule 11).
 */

import type { Scenario } from '../../models/scenario';
import type { Project } from '../model';

export type FixtureTemplateId =
  | 'cufts'
  | 'craneSupportedDownhillCable'
  | 'towerToGroundCable'
  | 'dualSupportSuspendedLine'
  | 'dualLineTrolley'
  | 'horizontalCableTrolley'
  | 'towTestFixture'
  | 'dropTestFixture'
  | 'suspendedPayloadRig'
  | 'portableMastFixture'
  | 'railTrackFixture'
  | 'customNodeElement'
  /** A project the user saved as a reusable template. */
  | 'userSaved';

export type TemplateStatus = 'implemented' | 'planned';

export interface FixtureTemplateInfo {
  id: FixtureTemplateId;
  name: string;
  description: string;
  status: TemplateStatus;
  /** Milestone that delivers (or delivered) the template. */
  milestone: string;
  /** Version of the template's data payload. */
  dataVersion: number;
}

export const FIXTURE_TEMPLATES: readonly FixtureTemplateInfo[] = [
  {
    id: 'cufts',
    name: 'TALON CUFTS fixture',
    description:
      'Crane-supported two-leg cable system with an instrumented downhill trolley ' +
      'and progressive ground braking. The validated v1 configuration.',
    status: 'implemented',
    milestone: 'M1–M6',
    dataVersion: 3,
  },
  {
    id: 'craneSupportedDownhillCable',
    name: 'Crane-supported downhill cable',
    description: 'Generic crane-supported descending cable without the CUFTS brake package.',
    status: 'planned',
    milestone: 'M8',
    dataVersion: 1,
  },
  {
    id: 'towerToGroundCable',
    name: 'Tower-to-ground cable',
    description: 'Fixed tower or mast high point descending to a ground anchor.',
    status: 'planned',
    milestone: 'M8',
    dataVersion: 1,
  },
  {
    id: 'dualSupportSuspendedLine',
    name: 'Dual-support suspended line',
    description: 'Cable spanning two elevated supports with a suspended load.',
    status: 'planned',
    milestone: 'M8',
    dataVersion: 1,
  },
  {
    id: 'dualLineTrolley',
    name: 'Dual-line trolley',
    description: 'Two parallel support lines with a wide trolley for roll stability.',
    status: 'planned',
    milestone: 'M11',
    dataVersion: 1,
  },
  {
    id: 'horizontalCableTrolley',
    name: 'Horizontal cable trolley',
    description: 'Near-level span with a powered or towed trolley.',
    status: 'planned',
    milestone: 'M9',
    dataVersion: 1,
  },
  {
    id: 'towTestFixture',
    name: 'Tow-test fixture',
    description: 'Towed test article with tow-line tension and speed profile.',
    status: 'planned',
    milestone: 'M9',
    dataVersion: 1,
  },
  {
    id: 'dropTestFixture',
    name: 'Drop-test fixture',
    description: 'Guided or free-drop fixture with arrest and energy absorption.',
    status: 'planned',
    milestone: 'M10',
    dataVersion: 1,
  },
  {
    id: 'suspendedPayloadRig',
    name: 'Suspended payload rig',
    description: 'Statically suspended payload with pendulum and sway assessment.',
    status: 'planned',
    milestone: 'M9',
    dataVersion: 1,
  },
  {
    id: 'portableMastFixture',
    name: 'Portable mast fixture',
    description: 'Portable mast high point with guy lines in place of a crane.',
    status: 'planned',
    milestone: 'M17',
    dataVersion: 1,
  },
  {
    id: 'railTrackFixture',
    name: 'Rail or track fixture',
    description: 'Rail-guided carriage with defined acceleration and braking zones.',
    status: 'planned',
    milestone: 'M17',
    dataVersion: 1,
  },
  {
    id: 'customNodeElement',
    name: 'Custom node-and-element project',
    description: 'Free-form model built directly from nodes and elements.',
    status: 'planned',
    milestone: 'M17',
    dataVersion: 1,
  },
  {
    id: 'userSaved',
    name: 'User-saved template',
    description: 'A completed project saved by the user as a reusable template.',
    status: 'planned',
    milestone: 'M7',
    dataVersion: 1,
  },
];

export function getTemplateInfo(id: FixtureTemplateId): FixtureTemplateInfo | undefined {
  return FIXTURE_TEMPLATES.find((t) => t.id === id);
}

export function isTemplateImplemented(id: FixtureTemplateId): boolean {
  return getTemplateInfo(id)?.status === 'implemented';
}

export function implementedTemplates(): FixtureTemplateInfo[] {
  return FIXTURE_TEMPLATES.filter((t) => t.status === 'implemented');
}

export function plannedTemplates(): FixtureTemplateInfo[] {
  return FIXTURE_TEMPLATES.filter((t) => t.status === 'planned');
}

/** Builder signature a template must provide to become implemented. */
export type TemplateBuilder = (
  scenario: Scenario,
  options?: { id?: string; createdOn?: string; revision?: string },
) => Project;

const builders = new Map<FixtureTemplateId, TemplateBuilder>();

export function registerTemplateBuilder(id: FixtureTemplateId, builder: TemplateBuilder): void {
  if (!isTemplateImplemented(id)) {
    throw new Error(
      `Template "${id}" is declared as planned, not implemented; ` +
        'update FIXTURE_TEMPLATES before registering a builder.',
    );
  }
  builders.set(id, builder);
}

/**
 * Instantiates a project from a template.
 *
 * Throws for planned-but-unimplemented templates rather than returning an
 * empty or guessed model — TALON never fabricates a fixture it cannot build.
 */
export function instantiateTemplate(
  id: FixtureTemplateId,
  scenario: Scenario,
  options?: { id?: string; createdOn?: string; revision?: string },
): Project {
  const info = getTemplateInfo(id);
  if (!info) throw new Error(`Unknown fixture template "${id}".`);
  if (info.status !== 'implemented') {
    throw new Error(
      `Fixture template "${info.name}" is planned for ${info.milestone} and is not ` +
        'implemented in this build. It cannot be instantiated.',
    );
  }
  const builder = builders.get(id);
  if (!builder) {
    throw new Error(`Template "${id}" is marked implemented but has no registered builder.`);
  }
  return builder(scenario, options);
}

/** Clears registered builders. Test-support only. */
export function resetTemplateBuilders(): void {
  builders.clear();
}
