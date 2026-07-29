/**
 * Milestone 7C — library import merge, CSV trust rules, adapter compliance.
 *
 * The import UI merges through `mergeIncomingLibrary` (Rule 12 applies to
 * imports), CSV cannot assert verification (empty→missing, never 0), and the
 * shipped adapters ship no network access and pass the compliance gate.
 */
import { describe, it, expect } from 'vitest';
import { mergeIncomingLibrary, blankRecord } from '../core/library/recordEdits';
import {
  createLibrary,
  mergeRecord,
  recordVerificationState,
  type ComponentLibrary,
  type ComponentRecord,
} from '../core/library/componentLibrary';
import { quantity } from '../core/provenance';
import { exportLibraryJson, importLibraryJson, exportLibraryCsv, importLibraryCsv } from '../core/library/libraryIo';
import { BUILT_IN_ADAPTERS, validateAdapter } from '../core/library/sourceAdapters';

function verifiedRecord(id: string, valueSI: number): ComponentRecord {
  return {
    ...blankRecord({ id, category: 'shackle', name: id, state: 'manufacturerVerified' }),
    properties: [{ key: 'wll', label: 'WLL', quantity: quantity(valueSI, 'force', 'manufacturerVerified') }],
  };
}
function libWith(record: ComponentRecord): ComponentLibrary {
  const out = mergeRecord(createLibrary('base'), record);
  if (!out.ok) throw new Error(out.reason);
  return out.library;
}

describe('mergeIncomingLibrary', () => {
  it('adds new records and reports counts', () => {
    const incoming = libWith(verifiedRecord('r1', 1000));
    const summary = mergeIncomingLibrary(createLibrary('current'), incoming);
    expect(summary.added).toBe(1);
    expect(summary.updated).toBe(0);
    expect(summary.refused).toHaveLength(0);
    expect(summary.library.records).toHaveLength(1);
  });

  it('refuses to overwrite a verified record with unverified import data', () => {
    const current = libWith(verifiedRecord('r1', 1000));
    // Incoming has the same id but is only importedUnverified.
    const incoming = libWith({
      ...blankRecord({ id: 'r1', category: 'shackle', name: 'r1', state: 'importedUnverified' }),
      properties: [{ key: 'wll', label: 'WLL', quantity: quantity(999, 'force', 'importedUnverified') }],
    });
    const summary = mergeIncomingLibrary(current, incoming);
    expect(summary.updated).toBe(0);
    expect(summary.refused).toHaveLength(1);
    expect(summary.refused[0].reason).toMatch(/verified|never overwritten/i);
    // The verified record is intact.
    expect(summary.library.records[0].properties[0].quantity.value).toBe(1000);
  });
});

describe('JSON round-trip through merge', () => {
  it('exported JSON re-imports and merges into an empty library unchanged', () => {
    const lib = libWith(verifiedRecord('r1', 1000));
    const imported = importLibraryJson(exportLibraryJson(lib, '1.1.0'));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      const summary = mergeIncomingLibrary(createLibrary('empty'), imported.library);
      expect(summary.library.records[0].properties[0].quantity.value).toBe(1000);
    }
  });
});

describe('CSV trust rules', () => {
  it('CSV import marks rows importedUnverified and keeps empty values missing', () => {
    const lib = libWith(verifiedRecord('r1', 1000));
    // Blank out the value cell to prove empty→missing.
    const csv = exportLibraryCsv(lib).replace('1000', '');
    const imported = importLibraryCsv(csv);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      const prop = imported.library.records[0].properties[0];
      expect(prop.quantity.value).toBeNull(); // missing, not 0
      expect(prop.quantity.provenance.state).toBe('missing');
      // The record can never come back verified from a CSV.
      expect(recordVerificationState(imported.library.records[0])).not.toBe('manufacturerVerified');
      expect(imported.notes.join(' ')).toMatch(/importedUnverified/i);
    }
  });
});

describe('source-adapter compliance', () => {
  it('every shipped adapter is network-disabled and passes the compliance gate', () => {
    expect(BUILT_IN_ADAPTERS.length).toBeGreaterThan(0);
    for (const a of BUILT_IN_ADAPTERS) {
      expect(a.networkEnabled).toBe(false);
      expect(validateAdapter(a)).toHaveLength(0);
    }
  });

  it('refuses an adapter that bypasses access controls or declares no basis', () => {
    expect(
      validateAdapter({
        id: 'bad', name: 'bad', sourceKind: 'distributorCatalog', networkEnabled: true,
        compliance: { basis: '', respectsSiteTerms: false, bypassesAccessControls: true },
      }).length,
    ).toBeGreaterThan(0);
  });
});
