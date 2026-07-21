/**
 * Component-library import/export — Milestone 7.
 *
 * JSON round-trips the full library including provenance and history. CSV is a
 * flat property-per-row interchange for spreadsheets; because CSV cannot carry
 * the full provenance graph, CSV imports enter as `importedUnverified` and say
 * so (Rule 12).
 */

import type { ComponentCategory } from '../model';
import { SI_UNIT, type Dimension } from '../dimensions';
import type { VerificationState } from '../provenance';
import {
  LIBRARY_SCHEMA_VERSION,
  type ComponentLibrary,
  type ComponentProperty,
  type ComponentRecord,
} from './componentLibrary';

export const LIBRARY_FILE_TYPE = 'talon-component-library';

export interface LibraryFile {
  fileType: typeof LIBRARY_FILE_TYPE;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  library: ComponentLibrary;
}

export type LibraryImportResult =
  | { ok: true; library: ComponentLibrary; notes: string[] }
  | { ok: false; errors: string[] };

// ── JSON ─────────────────────────────────────────────────────────────────

export function exportLibraryJson(lib: ComponentLibrary, appVersion: string): string {
  const file: LibraryFile = {
    fileType: LIBRARY_FILE_TYPE,
    schemaVersion: lib.schemaVersion,
    appVersion,
    exportedAt: new Date().toISOString(),
    library: lib,
  };
  return JSON.stringify(file, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function importLibraryJson(text: string): LibraryImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (!isRecord(parsed)) return { ok: false, errors: ['File is not a JSON object.'] };
  if (parsed.fileType !== LIBRARY_FILE_TYPE) {
    return { ok: false, errors: [`Unrecognized fileType ${JSON.stringify(parsed.fileType)}.`] };
  }
  if (!isRecord(parsed.library)) return { ok: false, errors: ['Envelope has no library object.'] };

  const raw = parsed.library;
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || version < 1) {
    return { ok: false, errors: [`Invalid library schemaVersion ${JSON.stringify(version)}.`] };
  }
  if (version > LIBRARY_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Library schemaVersion ${version} is newer than this build supports ` +
          `(v${LIBRARY_SCHEMA_VERSION}).`,
      ],
    };
  }
  if (!Array.isArray(raw.records)) {
    return { ok: false, errors: ['Library has no records array.'] };
  }

  const notes: string[] = [];
  const records: ComponentRecord[] = [];
  for (const [i, r] of (raw.records as unknown[]).entries()) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.name !== 'string') {
      return { ok: false, errors: [`Record ${i} is missing a valid id or name.`] };
    }
    if (!Array.isArray(r.properties)) {
      return { ok: false, errors: [`Record "${r.id}" has no properties array.`] };
    }
    records.push({
      id: r.id,
      category: r.category as ComponentCategory,
      name: r.name,
      manufacturer: typeof r.manufacturer === 'string' ? r.manufacturer : undefined,
      model: typeof r.model === 'string' ? r.model : undefined,
      partNumber: typeof r.partNumber === 'string' ? r.partNumber : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
      properties: r.properties as ComponentProperty[],
      attachments: Array.isArray(r.attachments) ? (r.attachments as ComponentRecord['attachments']) : [],
      provenance: (isRecord(r.provenance) && typeof r.provenance.state === 'string'
        ? (r.provenance as unknown as ComponentRecord['provenance'])
        : // A record arriving without a declared state is never assumed
          // trustworthy — it enters as imported-unverified (Rule 12).
          { state: 'importedUnverified' as const }),
      obsolete: r.obsolete === true,
      history: Array.isArray(r.history) ? (r.history as ComponentRecord['history']) : [],
      notes: typeof r.notes === 'string' ? r.notes : undefined,
    });
  }

  return {
    ok: true,
    notes,
    library: {
      schemaVersion: LIBRARY_SCHEMA_VERSION,
      revision: typeof raw.revision === 'string' ? raw.revision : '1',
      name: typeof raw.name === 'string' ? raw.name : 'Imported library',
      updatedOn: typeof raw.updatedOn === 'string' ? raw.updatedOn : new Date().toISOString(),
      records,
    },
  };
}

// ── CSV ──────────────────────────────────────────────────────────────────

const CSV_HEADER = [
  'recordId',
  'category',
  'name',
  'manufacturer',
  'model',
  'partNumber',
  'propertyKey',
  'propertyLabel',
  'value',
  'dimension',
  'unit',
  'sourceValue',
  'verificationState',
  'sourceDocument',
  'sourceUrl',
  'publishedOn',
  'retrievedOn',
  'deratingFactor',
  'deratingRule',
  'obsolete',
  'notes',
] as const;

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'number' ? String(v) : esc(v);
}

/** One row per property. Missing values export as EMPTY, never 0 (Rule 3). */
export function exportLibraryCsv(lib: ComponentLibrary): string {
  const lines: string[] = [CSV_HEADER.join(',')];
  for (const r of lib.records) {
    if (r.properties.length === 0) {
      lines.push(
        [
          cell(r.id), cell(r.category), cell(r.name), cell(r.manufacturer), cell(r.model),
          cell(r.partNumber), '', '', '', '', '', '', cell(r.provenance.state),
          cell(r.provenance.sourceDocument), cell(r.provenance.sourceUrl),
          cell(r.provenance.publishedOn), cell(r.provenance.retrievedOn), '', '',
          cell(String(r.obsolete)), cell(r.notes),
        ].join(','),
      );
      continue;
    }
    for (const p of r.properties) {
      const q = p.quantity;
      lines.push(
        [
          cell(r.id), cell(r.category), cell(r.name), cell(r.manufacturer), cell(r.model),
          cell(r.partNumber), cell(p.key), cell(p.label), cell(q.value), cell(q.dimension),
          cell(q.unit), cell(q.sourceValue ?? null), cell(q.provenance.state),
          cell(q.provenance.sourceDocument), cell(q.provenance.sourceUrl),
          cell(q.provenance.publishedOn), cell(q.provenance.retrievedOn),
          cell(q.provenance.deratingFactor ?? null), cell(q.provenance.deratingRule),
          cell(String(r.obsolete)), cell(r.notes),
        ].join(','),
      );
    }
  }
  return lines.join('\n');
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Imports a flat CSV. Because CSV cannot carry full provenance, every imported
 * property is marked `importedUnverified` unless the file states a state AND
 * that state is non-verified; a CSV can never assert verification (Rule 12).
 */
export function importLibraryCsv(
  text: string,
  libraryName = 'Imported CSV library',
): LibraryImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, errors: ['CSV has no data rows.'] };

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  for (const required of ['recordId', 'name', 'propertyKey', 'value', 'dimension']) {
    if (idx(required) === -1) {
      return { ok: false, errors: [`CSV is missing the required "${required}" column.`] };
    }
  }

  const notes: string[] = [
    'CSV import: every property was recorded as importedUnverified. A CSV cannot ' +
      'assert verification — confirm each critical rating against the manufacturer document.',
  ];
  const byId = new Map<string, ComponentRecord>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (name: string): string => (idx(name) >= 0 ? (cells[idx(name)] ?? '').trim() : '');
    const id = get('recordId');
    if (!id) return { ok: false, errors: [`Row ${i + 1}: recordId is empty.`] };

    const dimension = get('dimension') as Dimension;
    if (!(dimension in SI_UNIT)) {
      return { ok: false, errors: [`Row ${i + 1}: unknown dimension "${get('dimension')}".`] };
    }

    const rawValue = get('value');
    // An empty value is MISSING, not zero (Rule 3).
    const value = rawValue === '' ? null : Number(rawValue);
    if (value !== null && !Number.isFinite(value)) {
      return { ok: false, errors: [`Row ${i + 1}: value "${rawValue}" is not a finite number.`] };
    }
    const state: VerificationState = value === null ? 'missing' : 'importedUnverified';

    let record = byId.get(id);
    if (!record) {
      record = {
        id,
        category: (get('category') || 'structuralSteel') as ComponentCategory,
        name: get('name') || id,
        manufacturer: get('manufacturer') || undefined,
        model: get('model') || undefined,
        partNumber: get('partNumber') || undefined,
        properties: [],
        attachments: [],
        provenance: {
          state: 'importedUnverified',
          sourceType: 'csvImport',
          sourceDocument: get('sourceDocument') || undefined,
          sourceUrl: get('sourceUrl') || undefined,
          publishedOn: get('publishedOn') || undefined,
          retrievedOn: get('retrievedOn') || new Date().toISOString().slice(0, 10),
          notes: 'Imported from CSV; not verified.',
        },
        obsolete: get('obsolete').toLowerCase() === 'true',
        history: [],
        notes: get('notes') || undefined,
      };
      byId.set(id, record);
    }

    const key = get('propertyKey');
    if (key) {
      record.properties.push({
        key,
        label: get('propertyLabel') || key,
        quantity: {
          value,
          dimension,
          unit: SI_UNIT[dimension],
          provenance: {
            state,
            sourceType: 'csvImport',
            sourceDocument: get('sourceDocument') || undefined,
            sourceUrl: get('sourceUrl') || undefined,
            publishedOn: get('publishedOn') || undefined,
            retrievedOn: get('retrievedOn') || undefined,
          },
        },
      });
    }
  }

  return {
    ok: true,
    notes,
    library: {
      schemaVersion: LIBRARY_SCHEMA_VERSION,
      revision: '1',
      name: libraryName,
      updatedOn: new Date().toISOString(),
      records: [...byId.values()],
    },
  };
}
