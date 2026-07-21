/**
 * Versioned engineering component library — Milestone 7.
 *
 * Stores cable, rigging, trolley, brake, crane, anchor, structural, sensor and
 * instrumentation components with full property provenance.
 *
 * Governance enforced here:
 *   Rule 4  — no vendor data is hard-coded as certified. Seeded records are
 *             `exampleOnly` and a test asserts none claims verified.
 *   Rule 5  — derating never destroys the published value.
 *   Rule 12 — online/imported data enters as `importedUnverified`, retains its
 *             URL and retrieval date, and can NEVER overwrite a verified
 *             record (`mergeRecord` refuses).
 */

import type { ComponentCategory } from '../model';
import {
  isVerified,
  worstState,
  type Provenance,
  type Quantity,
  type VerificationState,
} from '../provenance';

/** A single engineering property of a component. */
export interface ComponentProperty {
  /** Stable key, e.g. 'workingLoadLimit', 'minimumBreakingStrength'. */
  key: string;
  label: string;
  quantity: Quantity;
  /** Conditions the value applies under. */
  applicability?: {
    temperatureRange?: { minC: number; maxC: number };
    loadingDirection?: string;
    speedRange?: { minMps: number; maxMps: number };
    dutyCycle?: string;
  };
}

/** An attached data sheet or document supporting the record. */
export interface SourceAttachment {
  id: string;
  fileName: string;
  /** Where the file lives; the library stores a reference, not the bytes. */
  location?: string;
  documentTitle?: string;
  revision?: string;
  publishedOn?: string;
  retrievedOn?: string;
  url?: string;
  /** Page/table supporting a specific property, keyed by property key. */
  supportsProperties?: Record<string, string>;
}

export interface ComponentRecord {
  id: string;
  category: ComponentCategory;
  name: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  description?: string;
  properties: ComponentProperty[];
  attachments: SourceAttachment[];
  /** Record-level provenance; individual properties may differ. */
  provenance: Provenance;
  /** Superseded records are retained for history but excluded from selection. */
  obsolete: boolean;
  /** Prior versions of this record, newest last. */
  history: ComponentRecordSnapshot[];
  notes?: string;
}

export interface ComponentRecordSnapshot {
  changedOn: string;
  changedBy?: string;
  summary: string;
  /** Verification state at the time of the change. */
  state: VerificationState;
}

export interface ComponentLibrary {
  schemaVersion: number;
  /** Library revision, bumped on every mutation. */
  revision: string;
  name: string;
  updatedOn: string;
  records: ComponentRecord[];
}

export const LIBRARY_SCHEMA_VERSION = 1;

export function createLibrary(name: string, updatedOn?: string): ComponentLibrary {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    revision: '1',
    name,
    updatedOn: updatedOn ?? new Date().toISOString(),
    records: [],
  };
}

/** Worst verification state across a record's properties. */
export function recordVerificationState(record: ComponentRecord): VerificationState {
  if (record.obsolete) return 'obsolete';
  const states = record.properties.map((p) => p.quantity);
  if (states.length === 0) return record.provenance.state;
  return worstState([...states, { ...states[0], provenance: record.provenance }]);
}

/** True when every property of the record is verified and it is not obsolete. */
export function isRecordVerified(record: ComponentRecord): boolean {
  return !record.obsolete && isVerified(recordVerificationState(record));
}

export function findRecord(lib: ComponentLibrary, id: string): ComponentRecord | undefined {
  return lib.records.find((r) => r.id === id);
}

export function findProperty(
  record: ComponentRecord,
  key: string,
): ComponentProperty | undefined {
  return record.properties.find((p) => p.key === key);
}

/** Records in a category, optionally excluding obsolete and unverified ones. */
export function selectRecords(
  lib: ComponentLibrary,
  category: ComponentCategory,
  options: { requireVerified?: boolean; includeObsolete?: boolean } = {},
): ComponentRecord[] {
  return lib.records.filter((r) => {
    if (r.category !== category) return false;
    if (!options.includeObsolete && r.obsolete) return false;
    if (options.requireVerified && !isRecordVerified(r)) return false;
    return true;
  });
}

export type MergeOutcome =
  | { ok: true; library: ComponentLibrary; action: 'added' | 'updated'; notes: string[] }
  | { ok: false; reason: string };

/**
 * Adds or updates a record.
 *
 * Rule 12: a verified record is never overwritten by an unverified one. The
 * attempt is refused with an explanation rather than silently dropped or
 * silently applied.
 */
export function mergeRecord(
  lib: ComponentLibrary,
  incoming: ComponentRecord,
  options: { changedBy?: string; changedOn?: string; summary?: string } = {},
): MergeOutcome {
  const changedOn = options.changedOn ?? new Date().toISOString();
  const existing = findRecord(lib, incoming.id);
  const notes: string[] = [];

  if (!existing) {
    const record: ComponentRecord = {
      ...incoming,
      history: [
        {
          changedOn,
          changedBy: options.changedBy,
          summary: options.summary ?? 'Record created.',
          state: incoming.provenance.state,
        },
      ],
    };
    return {
      ok: true,
      action: 'added',
      notes,
      library: bump(lib, [...lib.records, record], changedOn),
    };
  }

  const existingVerified = isRecordVerified(existing);
  const incomingVerified = isVerified(incoming.provenance.state);

  if (existingVerified && !incomingVerified) {
    return {
      ok: false,
      reason:
        `Refused: "${existing.name}" (${existing.id}) is verified ` +
        `(${recordVerificationState(existing)}), and the incoming record is ` +
        `${incoming.provenance.state}. A verified record is never overwritten by ` +
        'unverified data. Verify the new source first, or store it under a new id.',
    };
  }

  if (existing.provenance.publishedOn && incoming.provenance.publishedOn) {
    if (incoming.provenance.publishedOn < existing.provenance.publishedOn) {
      notes.push(
        `Incoming document (${incoming.provenance.publishedOn}) is older than the stored ` +
          `one (${existing.provenance.publishedOn}); verify which revision is current.`,
      );
    }
  }
  if (!incoming.provenance.publishedOn) {
    notes.push('Incoming record has no publication date; currency cannot be confirmed.');
  }

  const merged: ComponentRecord = {
    ...incoming,
    history: [
      ...existing.history,
      {
        changedOn,
        changedBy: options.changedBy,
        summary: options.summary ?? 'Record updated.',
        state: incoming.provenance.state,
      },
    ],
  };
  return {
    ok: true,
    action: 'updated',
    notes,
    library: bump(
      lib,
      lib.records.map((r) => (r.id === incoming.id ? merged : r)),
      changedOn,
    ),
  };
}

/** Marks a record obsolete, retaining it for history. */
export function markObsolete(
  lib: ComponentLibrary,
  id: string,
  reason: string,
  changedOn?: string,
): ComponentLibrary {
  const on = changedOn ?? new Date().toISOString();
  return bump(
    lib,
    lib.records.map((r) =>
      r.id === id
        ? {
            ...r,
            obsolete: true,
            history: [...r.history, { changedOn: on, summary: `Marked obsolete: ${reason}`, state: 'obsolete' as const }],
          }
        : r,
    ),
    on,
  );
}

function bump(
  lib: ComponentLibrary,
  records: ComponentRecord[],
  updatedOn: string,
): ComponentLibrary {
  const next = String(Number(lib.revision) + 1);
  return { ...lib, records, revision: next, updatedOn };
}

// ── warnings surfaced to the user ────────────────────────────────────────

export interface LibraryWarning {
  recordId: string;
  severity: 'info' | 'caution' | 'critical';
  message: string;
}

/**
 * Flags data that is outdated, incomplete, conflicting, or ambiguous — the
 * user must be told rather than left to assume the library is sound.
 */
export function auditLibrary(lib: ComponentLibrary, today?: string): LibraryWarning[] {
  const warnings: LibraryWarning[] = [];
  const now = today ?? new Date().toISOString();
  const seen = new Map<string, string>();

  for (const record of lib.records) {
    const state = recordVerificationState(record);

    if (state === 'exampleOnly') {
      warnings.push({
        recordId: record.id,
        severity: 'critical',
        message: `"${record.name}" is EXAMPLE ONLY seed data and must not be used for design.`,
      });
    }
    if (state === 'importedUnverified') {
      warnings.push({
        recordId: record.id,
        severity: 'caution',
        message: `"${record.name}" was imported and is unverified; confirm against the current manufacturer document.`,
      });
    }
    if (record.obsolete) {
      warnings.push({
        recordId: record.id,
        severity: 'caution',
        message: `"${record.name}" is obsolete and is excluded from selection.`,
      });
    }
    if (record.properties.length === 0) {
      warnings.push({
        recordId: record.id,
        severity: 'caution',
        message: `"${record.name}" has no engineering properties recorded.`,
      });
    }
    for (const p of record.properties) {
      if (p.quantity.value === null) {
        warnings.push({
          recordId: record.id,
          severity: 'caution',
          message: `"${record.name}" property "${p.label}" is not entered; dependent checks cannot be evaluated.`,
        });
      }
    }
    // Outdated: published more than 5 years before "now".
    const published = record.provenance.publishedOn;
    if (published) {
      const ageMs = Date.parse(now) - Date.parse(published);
      if (Number.isFinite(ageMs) && ageMs > 5 * 365.25 * 24 * 3600 * 1000) {
        warnings.push({
          recordId: record.id,
          severity: 'caution',
          message: `"${record.name}" cites a document published ${published}; confirm it is still current.`,
        });
      }
    } else if (!record.obsolete) {
      warnings.push({
        recordId: record.id,
        severity: 'info',
        message: `"${record.name}" has no source publication date.`,
      });
    }
    // Ambiguous: two records claiming the same manufacturer + part number.
    const key = `${record.manufacturer ?? ''}|${record.partNumber ?? ''}`;
    if (record.partNumber) {
      const prior = seen.get(key);
      if (prior) {
        warnings.push({
          recordId: record.id,
          severity: 'caution',
          message: `"${record.name}" duplicates part number ${record.partNumber} already held by ${prior}; resolve the conflict.`,
        });
      } else {
        seen.set(key, record.id);
      }
    }
  }
  return warnings;
}
