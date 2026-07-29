/**
 * Standards import/export — Milestone 9A.
 *
 * Versioned JSON envelope for a `Standards` document, so a team can version it
 * in a shared Git repo and pull the latest. Import re-validates structure and
 * rejects a malformed or too-new file with an explicit reason (never silently
 * accepted). An imported document keeps its own `starterTemplate` flag — an
 * approved org standard (flag false) stays approved.
 */
import { STANDARDS_SCHEMA_VERSION, checkStandards, type Standards } from './standards';

export const STANDARDS_FILE_TYPE = 'talon-standards';

export interface StandardsFile {
  fileType: typeof STANDARDS_FILE_TYPE;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  standards: Standards;
}

export type StandardsImportResult =
  | { ok: true; standards: Standards; notes: string[] }
  | { ok: false; errors: string[] };

export function exportStandardsJson(standards: Standards, appVersion: string): string {
  const file: StandardsFile = {
    fileType: STANDARDS_FILE_TYPE,
    schemaVersion: standards.schemaVersion,
    appVersion,
    exportedAt: new Date().toISOString(),
    standards,
  };
  return JSON.stringify(file, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function importStandardsJson(text: string): StandardsImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (!isRecord(parsed)) return { ok: false, errors: ['File is not a JSON object.'] };
  if (parsed.fileType !== STANDARDS_FILE_TYPE) {
    return { ok: false, errors: [`Unrecognized fileType ${JSON.stringify(parsed.fileType)}.`] };
  }
  const version = parsed.schemaVersion;
  if (typeof version !== 'number' || version < 1) {
    return { ok: false, errors: [`Invalid standards schemaVersion ${JSON.stringify(version)}.`] };
  }
  if (version > STANDARDS_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Standards schemaVersion ${version} is newer than this build supports (v${STANDARDS_SCHEMA_VERSION}).`],
    };
  }
  if (!isRecord(parsed.standards)) return { ok: false, errors: ['Envelope has no standards object.'] };

  const raw = parsed.standards as Partial<Standards>;
  for (const key of ['designFactors', 'allowableLimits', 'loadCombinationTemplates'] as const) {
    if (!Array.isArray(raw[key])) {
      return { ok: false, errors: [`Standards is missing its "${key}" array.`] };
    }
  }
  if (!isRecord(raw.verificationPolicy)) {
    return { ok: false, errors: ['Standards is missing its verificationPolicy.'] };
  }

  const standards: Standards = {
    schemaVersion: STANDARDS_SCHEMA_VERSION,
    name: typeof raw.name === 'string' ? raw.name : 'Imported standards',
    revision: typeof raw.revision === 'string' ? raw.revision : '1',
    organization: typeof raw.organization === 'string' ? raw.organization : undefined,
    updatedOn: typeof raw.updatedOn === 'string' ? raw.updatedOn : new Date().toISOString(),
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    starterTemplate: raw.starterTemplate === true,
    designFactors: raw.designFactors as Standards['designFactors'],
    allowableLimits: raw.allowableLimits as Standards['allowableLimits'],
    verificationPolicy: raw.verificationPolicy as Standards['verificationPolicy'],
    loadCombinationTemplates: raw.loadCombinationTemplates as Standards['loadCombinationTemplates'],
  };

  const errors = checkStandards(standards).filter((i) => i.severity === 'error');
  if (errors.length > 0) return { ok: false, errors: errors.map((e) => e.message) };
  return { ok: true, standards, notes: [] };
}
