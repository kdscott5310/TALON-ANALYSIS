/**
 * Milestone 7B — record & property editing with provenance.
 *
 * Covers the pure record-edit helpers and the governance rules the editor must
 * uphold via mergeRecord: a verified record is never overwritten by unverified
 * data (Rule 12), a missing property stays null (Rule 4), the source value is
 * preserved on edit (Rule 5), obsolete records leave selection, and edited
 * records round-trip through serialization with provenance intact.
 */
import { describe, it, expect } from 'vitest';
import {
  blankRecord,
  setRecordProperty,
  removeRecordProperty,
  updateRecordProvenance,
  updateRecordFields,
} from '../core/library/recordEdits';
import {
  createLibrary,
  mergeRecord,
  markObsolete,
  isRecordVerified,
  recordVerificationState,
  selectRecords,
  type ComponentRecord,
} from '../core/library/componentLibrary';
import { updatedQuantity } from '../core/projectEdits';
import { quantity, missing } from '../core/provenance';
import { exportLibraryJson, importLibraryJson } from '../core/library/libraryIo';

function libWith(record: ComponentRecord) {
  const out = mergeRecord(createLibrary('t'), record);
  if (!out.ok) throw new Error(out.reason);
  return out.library;
}

const verifiedProp = (key: string, valueSI: number) => ({
  key,
  label: key,
  quantity: quantity(valueSI, 'force', 'manufacturerVerified'),
});

describe('record-edit helpers', () => {
  it('blankRecord starts provisional with no properties', () => {
    const r = blankRecord({ id: 'r1', category: 'cable', name: 'Cable' });
    expect(r.provenance.state).toBe('provisional');
    expect(r.properties).toHaveLength(0);
    expect(r.obsolete).toBe(false);
  });

  it('set/remove property and patch fields/provenance are immutable', () => {
    const r0 = blankRecord({ id: 'r1', category: 'cable', name: 'Cable' });
    const r1 = setRecordProperty(r0, verifiedProp('mbs', 1000));
    expect(r0.properties).toHaveLength(0); // immutable
    expect(r1.properties).toHaveLength(1);
    const r2 = setRecordProperty(r1, verifiedProp('mbs', 2000)); // replace by key
    expect(r2.properties).toHaveLength(1);
    expect(r2.properties[0].quantity.value).toBe(2000);
    expect(removeRecordProperty(r2, 'mbs').properties).toHaveLength(0);
    expect(updateRecordFields(r2, { manufacturer: 'ACME' }).manufacturer).toBe('ACME');
    expect(updateRecordProvenance(r2, { sourceUrl: 'x' }).provenance.sourceUrl).toBe('x');
  });
});

describe('governance via mergeRecord', () => {
  it('refuses to overwrite a verified record with unverified data, with a reason', () => {
    const verified: ComponentRecord = {
      ...blankRecord({ id: 'r1', category: 'shackle', name: 'Shackle', state: 'manufacturerVerified' }),
      properties: [verifiedProp('wll', 98000)],
    };
    const lib = libWith(verified);
    expect(isRecordVerified(lib.records[0])).toBe(true);

    // Attempt to downgrade to provisional.
    const downgraded = updateRecordProvenance(lib.records[0], { state: 'provisional' });
    const outcome = mergeRecord(lib, downgraded);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/verified|never overwritten/i);
  });

  it('allows editing a verified record while keeping it verified', () => {
    const verified: ComponentRecord = {
      ...blankRecord({ id: 'r1', category: 'shackle', name: 'Shackle', state: 'manufacturerVerified' }),
      properties: [verifiedProp('wll', 98000)],
    };
    const lib = libWith(verified);
    const edited = updateRecordFields(lib.records[0], { manufacturer: 'ACME' });
    const outcome = mergeRecord(lib, edited);
    expect(outcome.ok).toBe(true);
  });
});

describe('provenance rules on property edits', () => {
  it('editing a value preserves the source value; missing stays null', () => {
    // derated working value with a preserved source value
    const derated = quantity(800, 'force', 'manufacturerVerified');
    derated.sourceValue = 1000;
    const edited = updatedQuantity(derated, 900, 'userVerified', 'force');
    expect(edited.value).toBe(900);
    expect(edited.sourceValue).toBe(1000);

    const cleared = missing('force');
    expect(cleared.value).toBeNull();
    expect(cleared.provenance.state).toBe('missing');
  });
});

describe('obsolete & durability', () => {
  it('marking obsolete removes a record from selection', () => {
    const rec: ComponentRecord = {
      ...blankRecord({ id: 'r1', category: 'cable', name: 'Cable', state: 'userVerified' }),
      properties: [verifiedProp('mbs', 1000)],
    };
    let lib = libWith(rec);
    expect(selectRecords(lib, 'cable')).toHaveLength(1);
    lib = markObsolete(lib, 'r1', 'superseded');
    expect(selectRecords(lib, 'cable')).toHaveLength(0);
    expect(recordVerificationState(lib.records[0])).toBe('obsolete');
  });

  it('an edited library round-trips through JSON with provenance intact', () => {
    const rec: ComponentRecord = {
      ...blankRecord({ id: 'r1', category: 'cable', name: 'Cable', state: 'userVerified' }),
      properties: [{ key: 'mbs', label: 'MBS', quantity: quantity(130000, 'force', 'userVerified') }],
    };
    const lib = libWith(rec);
    const rt = importLibraryJson(exportLibraryJson(lib, '1.1.0'));
    expect(rt.ok).toBe(true);
    if (rt.ok) {
      expect(rt.library.records[0].properties[0].quantity.value).toBe(130000);
      expect(rt.library.records[0].properties[0].quantity.provenance.state).toBe('userVerified');
    }
  });
});
