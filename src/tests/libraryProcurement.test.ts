/**
 * Milestone 7E — BOM assembly & procurement sheet.
 *
 * A demand with a passing candidate becomes a selected BOM line; a demand with
 * none becomes a PROCUREMENT REQUIRED line (never a fabricated part). The sheet
 * distinguishes calculated requirement / recommended minimum / selected /
 * verified, and the CSV marks unselected demands PROCUREMENT REQUIRED.
 */
import { describe, it, expect } from 'vitest';
import { sizeComponent, assembleBom, type SizingResult } from '../calculations/componentSizing';
import {
  buildProcurementSheet,
  procurementSheetCsv,
} from '../reports/procurementSheet';
import { createLibrary, mergeRecord, type ComponentLibrary, type ComponentRecord } from '../core/library/componentLibrary';
import { blankRecord } from '../core/library/recordEdits';
import { quantity } from '../core/provenance';

function shackle(id: string, wll: number, state: 'userVerified' | 'exampleOnly' = 'userVerified'): ComponentRecord {
  return {
    ...blankRecord({ id, category: 'shackle', name: id, state }),
    properties: [{ key: 'workingLoadLimit', label: 'WLL', quantity: quantity(wll, 'force', state) }],
  };
}
function libOf(...records: ComponentRecord[]): ComponentLibrary {
  let lib = createLibrary('t');
  for (const rec of records) {
    const out = mergeRecord(lib, rec);
    if (!out.ok) throw new Error(out.reason);
    lib = out.library;
  }
  return lib;
}
function size(lib: ComponentLibrary, label: string, demand: number): SizingResult {
  return sizeComponent(lib, { label, category: 'shackle', ratingKey: 'workingLoadLimit', demand, designFactor: 5 });
}

describe('assembleBom', () => {
  it('selects a passing candidate and marks a no-candidate demand for procurement', () => {
    const passLib = libOf(shackle('big', 120000));
    const emptyLib = createLibrary('empty');
    const bom = assembleBom([size(passLib, 'Sling A', 10000), size(emptyLib, 'Sling B', 10000)]);

    expect(bom[0].disposition).toBe('selected');
    expect(bom[0].selected?.recordId).toBe('big');
    expect(bom[1].disposition).toBe('procurementRequired');
    expect(bom[1].selected).toBeNull();
  });
});

describe('procurement sheet', () => {
  const passLib = libOf(shackle('verified-big', 120000, 'userVerified'));
  const exampleLib = libOf(shackle('example-big', 120000, 'exampleOnly'));
  const emptyLib = createLibrary('empty');

  it('distinguishes selected/verified vs procurement-required', () => {
    const results = [
      size(passLib, 'Sling A', 10000),   // selected + verified
      size(exampleLib, 'Sling B', 10000), // selected but example-only → not verified
      size(emptyLib, 'Sling C', 10000),   // no candidate → procurement
    ];
    const ratingKeys = { 'Sling A': 'workingLoadLimit', 'Sling B': 'workingLoadLimit', 'Sling C': 'workingLoadLimit' };
    const sheet = buildProcurementSheet(results, ratingKeys);

    expect(sheet.lines[0].selected?.verified).toBe(true);
    expect(sheet.lines[1].selected?.verified).toBe(false);
    expect(sheet.lines[2].selected).toBeNull();
    // Calculated requirement is reported as a requirement, distinct from selection.
    expect(sheet.lines[0].calculatedRequirementSI).toBe(50000);
    expect(sheet.lines[0].searchPhrase).toMatch(/working load limit/i);
  });

  it('CSV marks unselected demands PROCUREMENT REQUIRED', () => {
    const results = [size(passLib, 'Sling A', 10000), size(emptyLib, 'Sling C', 10000)];
    const csv = procurementSheetCsv(
      buildProcurementSheet(results, { 'Sling A': 'workingLoadLimit', 'Sling C': 'workingLoadLimit' }),
    );
    expect(csv).toMatch(/PROCUREMENT REQUIRED/);
    expect(csv).toMatch(/DISCLAIMER/);
  });
});
