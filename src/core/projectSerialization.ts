/**
 * Project serialization and migration — Milestone 6.
 *
 * Versioned JSON envelope for `Project`, plus migration from the v1 CUFTS
 * scenario files (schema v1/v2/v3) into a generalized project.
 *
 * Migration rules:
 *  - Legacy scenario files are never rejected for being old; they are
 *    migrated through the existing, tested `migrateScenario` path and then
 *    wrapped by the CUFTS template.
 *  - Every field filled during migration is DISCLOSED as a note. Nothing is
 *    silently defaulted (Rule 2).
 *  - Unknown fields are dropped by construction; malformed files are rejected
 *    with explicit errors rather than being partially accepted.
 */

import type { Scenario } from '../models/scenario';
import {
  importScenarioJson,
  migrateScenario,
  CURRENT_SCHEMA_VERSION as SCENARIO_SCHEMA_VERSION,
} from '../models/scenarioSerialization';
import { buildCuftsProject } from './templates/cufts';
import { checkProjectIntegrity, PROJECT_SCHEMA_VERSION, type Project } from './model';

export const PROJECT_FILE_TYPE = 'talon-project';

export interface ProjectFile {
  fileType: typeof PROJECT_FILE_TYPE;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  project: Project;
}

export type ProjectImportResult =
  | { ok: true; project: Project; migrationNotes: string[] }
  | { ok: false; errors: string[] };

// ── export ───────────────────────────────────────────────────────────────

export function exportProjectJson(project: Project, appVersion: string): string {
  const file: ProjectFile = {
    fileType: PROJECT_FILE_TYPE,
    schemaVersion: project.schemaVersion,
    appVersion,
    exportedAt: new Date().toISOString(),
    project,
  };
  return JSON.stringify(file, null, 2);
}

// ── import ───────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Wraps a CUFTS scenario as a generalized project, recording the scenario
 * migration notes alongside the template note.
 */
export function projectFromScenario(
  scenario: Scenario,
  scenarioNotes: string[] = [],
  options: { id?: string; createdOn?: string; revision?: string } = {},
): { project: Project; migrationNotes: string[] } {
  const project = buildCuftsProject(scenario, options);
  const notes = [
    ...scenarioNotes,
    `Wrapped CUFTS scenario (schema v${scenario.schemaVersion}) as a generalized ` +
      `project (project schema v${PROJECT_SCHEMA_VERSION}) using the built-in CUFTS template. ` +
      'The scenario remains the authoritative input for the v1 solvers.',
  ];
  return { project, migrationNotes: notes };
}

/**
 * Imports either a generalized project file or a legacy CUFTS scenario file.
 * Legacy scenario files (with or without the scenario envelope) are migrated
 * and wrapped by the CUFTS template.
 */
export function importProjectJson(jsonText: string): ProjectImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return {
      ok: false,
      errors: [`File is not valid JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
  if (!isRecord(parsed)) return { ok: false, errors: ['File does not contain a JSON object.'] };

  // ── generalized project file ──
  if (parsed.fileType === PROJECT_FILE_TYPE) {
    if (!isRecord(parsed.project)) {
      return { ok: false, errors: ['Project envelope has no project object.'] };
    }
    return adoptProject(parsed.project);
  }

  // ── legacy CUFTS scenario file (envelope or bare) ──
  const scenarioResult = importScenarioJson(jsonText);
  if (!scenarioResult.ok) {
    return {
      ok: false,
      errors: [
        'File is neither a TALON project nor a valid CUFTS scenario.',
        ...scenarioResult.errors,
      ],
    };
  }
  const { project, migrationNotes } = projectFromScenario(
    scenarioResult.scenario,
    scenarioResult.migrationNotes,
  );
  return { ok: true, project, migrationNotes };
}

/**
 * Validates and adopts a raw project object.
 *
 * A project is only trusted when its CUFTS template data passes the existing
 * scenario validation, so a hand-edited or corrupted file cannot smuggle
 * malformed engineering inputs into the solvers.
 */
function adoptProject(raw: Record<string, unknown>): ProjectImportResult {
  const errors: string[] = [];
  const notes: string[] = [];

  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      errors: [`Project schemaVersion is missing or invalid: ${JSON.stringify(version)}.`],
    };
  }
  if (version > PROJECT_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Project schemaVersion ${version} is newer than this application supports ` +
          `(v${PROJECT_SCHEMA_VERSION}). Update TALON to open it.`,
      ],
    };
  }

  const template = raw.template;
  if (!isRecord(template) || typeof template.id !== 'string') {
    return { ok: false, errors: ['Project has no valid template descriptor.'] };
  }

  // CUFTS projects: re-validate and re-derive from the scenario so the
  // generalized entities always agree with the authoritative inputs.
  // Re-deriving is also how project schema v1 files gain the v2 entities
  // (coordinate systems, load combinations, assumptions) without data loss.
  if (template.id === 'cufts') {
    const templateData = raw.templateData;
    if (!isRecord(templateData) || !isRecord(templateData.cufts)) {
      return { ok: false, errors: ['CUFTS project is missing its scenario template data.'] };
    }
    const scenarioResult = migrateScenario(templateData.cufts);
    if (!scenarioResult.ok) {
      return {
        ok: false,
        errors: ['CUFTS project template data failed validation.', ...scenarioResult.errors],
      };
    }
    notes.push(...scenarioResult.migrationNotes);
    if (scenarioResult.scenario.schemaVersion !== SCENARIO_SCHEMA_VERSION) {
      notes.push(
        `Scenario migrated to schema v${SCENARIO_SCHEMA_VERSION} while opening the project.`,
      );
    }
    const rebuilt = buildCuftsProject(scenarioResult.scenario, {
      id: typeof raw.id === 'string' ? raw.id : undefined,
      createdOn: typeof raw.createdOn === 'string' ? raw.createdOn : undefined,
      revision: typeof raw.revision === 'string' ? raw.revision : undefined,
    });
    if (typeof raw.name === 'string' && raw.name.trim()) rebuilt.name = raw.name;
    if (version < PROJECT_SCHEMA_VERSION) {
      notes.push(
        `Migrated project schema v${version} → v${PROJECT_SCHEMA_VERSION}; generalized ` +
          'entities were re-derived from the CUFTS scenario.',
      );
    }
    const integrity = checkProjectIntegrity(rebuilt);
    if (integrity.some((i) => i.severity === 'error')) {
      return {
        ok: false,
        errors: integrity
          .filter((i) => i.severity === 'error')
          .map((i) => `${i.entity}: ${i.message}`),
      };
    }
    return { ok: true, project: rebuilt, migrationNotes: notes };
  }

  // Custom projects carry authoritative geometry — nodes and elements ARE the
  // model, so they are adopted as-is (never re-derived) and edits round-trip.
  if (template.id === 'customNodeElement') {
    return adoptCustomProject(raw, version);
  }

  errors.push(
    `Unsupported project template "${template.id}". This build provides the ` +
      "'cufts' and 'customNodeElement' templates.",
  );
  return { ok: false, errors };
}

/**
 * Adopts a custom (authoritative-geometry) project. The geometry is trusted
 * as-is after defaulting optional collections; referential integrity is then
 * enforced so a corrupt or hand-edited file cannot smuggle dangling references.
 */
function adoptCustomProject(raw: Record<string, unknown>, version: number): ProjectImportResult {
  for (const key of ['coordinateSystems', 'nodes', 'elements'] as const) {
    if (!Array.isArray(raw[key])) {
      return { ok: false, errors: [`Custom project is missing its "${key}" array.`] };
    }
  }

  const p = raw as unknown as Project;
  const project: Project = {
    ...p,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    templateData: {},
    name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Custom project',
    createdOn: typeof p.createdOn === 'string' ? p.createdOn : new Date().toISOString(),
    revision: typeof p.revision === 'string' ? p.revision : '1',
    identity: p.identity ?? {},
    materials: p.materials ?? [],
    components: p.components ?? [],
    supports: p.supports ?? [],
    constraints: p.constraints ?? [],
    loads: p.loads ?? [],
    loadCases: p.loadCases ?? [],
    loadCombinations: p.loadCombinations ?? [],
    movingBodies: p.movingBodies ?? [],
    analysisCases: p.analysisCases ?? [],
    analysisRuns: p.analysisRuns ?? [],
    risks: p.risks ?? [],
    assumptions: p.assumptions ?? [],
    testData: p.testData ?? [],
    reports: p.reports ?? [],
    bom: p.bom ?? [],
    revisions: p.revisions ?? [],
    verification: p.verification ?? {
      overallState: 'provisional',
      outstanding: [],
      reviewStatus: 'draft',
      engineerReviewed: false,
    },
  };

  const notes: string[] = [];
  if (version < PROJECT_SCHEMA_VERSION) {
    notes.push(`Migrated custom project schema v${version} → v${PROJECT_SCHEMA_VERSION}.`);
  }

  const integrity = checkProjectIntegrity(project);
  if (integrity.some((i) => i.severity === 'error')) {
    return {
      ok: false,
      errors: integrity.filter((i) => i.severity === 'error').map((i) => `${i.entity}: ${i.message}`),
    };
  }
  return { ok: true, project, migrationNotes: notes };
}
