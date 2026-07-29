/**
 * Pure component-record edit helpers — Milestone 7B.
 *
 * Immutable builders the record editor manipulates on a DRAFT record before
 * committing it to the library with `mergeRecord` (which enforces the rule that
 * a verified record is never overwritten by unverified data — Rule 12). These
 * helpers add no engineering math (Rules 2/7): they assemble record data and
 * preserve provenance (a missing value stays null, never 0; the source value is
 * carried by `updatedQuantity`, Rules 3/5).
 */
import type { ComponentCategory } from '../model';
import type { Provenance, VerificationState } from '../provenance';
import { mergeRecord, type ComponentLibrary, type ComponentProperty, type ComponentRecord } from './componentLibrary';

/** Creates a blank, property-less record with a working (provisional) provenance. */
export function blankRecord(spec: {
  id: string;
  category: ComponentCategory;
  name: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  description?: string;
  state?: VerificationState;
}): ComponentRecord {
  return {
    id: spec.id,
    category: spec.category,
    name: spec.name,
    manufacturer: spec.manufacturer,
    model: spec.model,
    partNumber: spec.partNumber,
    description: spec.description,
    properties: [],
    attachments: [],
    provenance: { state: spec.state ?? 'provisional' },
    obsolete: false,
    history: [],
  };
}

/** Adds a property, or replaces the existing one with the same key. */
export function setRecordProperty(record: ComponentRecord, property: ComponentProperty): ComponentRecord {
  const exists = record.properties.some((p) => p.key === property.key);
  const properties = exists
    ? record.properties.map((p) => (p.key === property.key ? property : p))
    : [...record.properties, property];
  return { ...record, properties };
}

export function removeRecordProperty(record: ComponentRecord, key: string): ComponentRecord {
  return { ...record, properties: record.properties.filter((p) => p.key !== key) };
}

/** Patches record-level provenance (source type/document/url, dates, state…). */
export function updateRecordProvenance(record: ComponentRecord, patch: Partial<Provenance>): ComponentRecord {
  return { ...record, provenance: { ...record.provenance, ...patch } };
}

/** Patches identity/description fields on a record. */
export function updateRecordFields(
  record: ComponentRecord,
  patch: Partial<Pick<ComponentRecord, 'name' | 'manufacturer' | 'model' | 'partNumber' | 'description' | 'notes'>>,
): ComponentRecord {
  return { ...record, ...patch };
}

export interface LibraryMergeSummary {
  library: ComponentLibrary;
  added: number;
  updated: number;
  /** Records refused (a verified record is never overwritten by unverified data). */
  refused: { id: string; reason: string }[];
  notes: string[];
}

/**
 * Merges every record from an imported library into the current one via
 * `mergeRecord`, so the verified-never-overwritten-by-unverified rule (Rule 12)
 * applies to imports: a refused record is reported, not silently applied.
 */
export function mergeIncomingLibrary(
  current: ComponentLibrary,
  incoming: ComponentLibrary,
): LibraryMergeSummary {
  let library = current;
  let added = 0;
  let updated = 0;
  const refused: { id: string; reason: string }[] = [];
  const notes: string[] = [];
  for (const record of incoming.records) {
    const outcome = mergeRecord(library, record);
    if (outcome.ok) {
      library = outcome.library;
      if (outcome.action === 'added') added++;
      else updated++;
      notes.push(...outcome.notes);
    } else {
      refused.push({ id: record.id, reason: outcome.reason });
    }
  }
  return { library, added, updated, refused, notes };
}
