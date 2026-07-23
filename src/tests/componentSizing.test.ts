/**
 * Milestone 13 — component sizing, candidate ranking, BOM, procurement.
 *
 * Focus: required rating = demand × design factor; deratings reduce the
 * published rating; obsolete/unverified parts are excluded when verified data
 * is required; a missing rating is insufficient information (never adequate);
 * no passing candidate becomes a procurement line, not a fabricated part.
 */
import { describe, it, expect } from 'vitest';
import {
  assembleBom,
  sizeComponent,
  type SizingDemand,
} from '../calculations/componentSizing';
import {
  buildProcurementSheet,
  buildSearchPhrase,
  procurementSheetCsv,
} from '../reports/procurementSheet';
import {
  createLibrary,
  mergeRecord,
  type ComponentLibrary,
  type ComponentRecord,
} from '../core/library/componentLibrary';
import { quantity } from '../core/provenance';

function shackle(id: string, wll: number, state: 'manufacturerVerified' | 'exampleOnly' | 'importedUnverified', obsolete = false): ComponentRecord {
  return {
    id,
    category: 'shackle',
    name: `Shackle ${id}`,
    partNumber: id.toUpperCase(),
    properties: [
      { key: 'workingLoadLimit', label: 'WLL', quantity: quantity(wll, 'force', state) },
    ],
    attachments: [],
    provenance: { state },
    obsolete,
    history: [],
  };
}

function libWith(...records: ComponentRecord[]): ComponentLibrary {
  let lib = createLibrary('L', '2026-01-01T00:00:00.000Z');
  for (const r of records) {
    const res = mergeRecord(lib, r);
    if (res.ok) lib = res.library;
  }
  return lib;
}

const demand = (over: Partial<SizingDemand> = {}): SizingDemand => ({
  label: 'Rigging shackle',
  category: 'shackle',
  ratingKey: 'workingLoadLimit',
  demand: 20000,
  designFactor: 2,
  ...over,
});

describe('component sizing', () => {
  it('computes required rating = demand × design factor and passes adequate parts', () => {
    const lib = libWith(shackle('s1', 50000, 'manufacturerVerified'));
    const r = sizeComponent(lib, demand());
    expect(r.requiredRating).toBe(40000); // 20000 × 2
    expect(r.anyPass).toBe(true);
    expect(r.passing[0].margin).toBeCloseTo(50000 / 40000, 9);
    expect(r.passing[0].utilization).toBeCloseTo(40000 / 50000, 9);
  });

  it('applies deratings to the published rating (Rule 5: kept separate)', () => {
    const lib = libWith(shackle('s1', 50000, 'manufacturerVerified'));
    const r = sizeComponent(lib, demand({ deratings: { temperature: 0.8 } }));
    const c = r.allCandidates.find((x) => x.recordId === 's1')!;
    expect(c.publishedRating).toBe(50000);
    expect(c.deratedRating).toBeCloseTo(40000, 6); // 50000 × 0.8
    // Derated 40000 exactly meets required 40000 → passes.
    expect(c.status).toBe('pass');
  });

  it('fails a component whose derated rating is below the requirement', () => {
    const lib = libWith(shackle('s1', 45000, 'manufacturerVerified'));
    const r = sizeComponent(lib, demand({ deratings: { temperature: 0.8 } })); // 36000 < 40000
    expect(r.anyPass).toBe(false);
    expect(r.allCandidates[0].status).toBe('fail');
    expect(r.allCandidates[0].reason).toMatch(/short by/i);
  });

  it('ranks passing candidates by margin, best first (does not auto-pick smallest)', () => {
    const lib = libWith(
      shackle('big', 120000, 'manufacturerVerified'),
      shackle('mid', 60000, 'manufacturerVerified'),
      shackle('small', 41000, 'manufacturerVerified'),
    );
    const r = sizeComponent(lib, demand());
    // All three are returned; ranked by margin.
    expect(r.passing.map((c) => c.recordId)).toEqual(['big', 'mid', 'small']);
    expect(r.allCandidates).toHaveLength(3);
  });

  it('excludes obsolete and unverified parts when verified data is required (Rule 4)', () => {
    const lib = libWith(
      shackle('ok', 50000, 'manufacturerVerified'),
      shackle('old', 90000, 'manufacturerVerified', true),
      shackle('web', 90000, 'importedUnverified'),
    );
    const r = sizeComponent(lib, demand({ requireVerified: true }));
    expect(r.passing.map((c) => c.recordId)).toEqual(['ok']);
    const old = r.allCandidates.find((c) => c.recordId === 'old')!;
    const web = r.allCandidates.find((c) => c.recordId === 'web')!;
    expect(old.status).toBe('excludedObsolete');
    expect(web.status).toBe('excludedUnverified');
  });

  it('treats a missing rating as insufficient information, never adequate (Rule 3)', () => {
    const noRating: ComponentRecord = {
      id: 'blank', category: 'shackle', name: 'Blank', properties: [],
      attachments: [], provenance: { state: 'provisional' }, obsolete: false, history: [],
    };
    const r = sizeComponent(libWith(noRating), demand());
    expect(r.anyPass).toBe(false);
    expect(r.allCandidates[0].status).toBe('insufficientInformation');
    expect(r.allCandidates[0].deratedRating).toBeNull();
  });

  it('warns when a category is empty (procurement needed)', () => {
    const r = sizeComponent(createLibrary('empty', '2026-01-01T00:00:00.000Z'), demand());
    expect(r.anyPass).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/procurement search/i);
  });
});

describe('bill of materials', () => {
  it('marks a demand with no passing candidate as procurementRequired, not a part', () => {
    const passLib = libWith(shackle('s1', 50000, 'manufacturerVerified'));
    const failResult = sizeComponent(createLibrary('e', '2026-01-01T00:00:00.000Z'), demand({ label: 'Brake anchor' }));
    const passResult = sizeComponent(passLib, demand({ label: 'Rigging shackle' }));
    const bom = assembleBom([passResult, failResult]);
    expect(bom[0].disposition).toBe('selected');
    expect(bom[0].selected!.recordId).toBe('s1');
    expect(bom[1].disposition).toBe('procurementRequired');
    expect(bom[1].selected).toBeNull();
    expect(bom[1].category).toBe('shackle');
  });
});

describe('procurement search sheet', () => {
  it('builds a useful search phrase with the rating', () => {
    const phrase = buildSearchPhrase({
      category: 'snatchBlock',
      requirementLabel: 'Suspended block',
      requiredRatingSI: 44480,
      ratingKey: 'workingLoadLimit',
    });
    expect(phrase).toMatch(/snatch block/i);
    expect(phrase).toMatch(/working load limit 44480 N/);
    expect(phrase).toMatch(/manufacturer/i);
  });

  it('distinguishes requirement from selected part and flags procurement', () => {
    const failResult = sizeComponent(createLibrary('e', '2026-01-01T00:00:00.000Z'), demand({ label: 'Brake anchor shackle' }));
    const sheet = buildProcurementSheet([failResult], { 'Brake anchor shackle': 'workingLoadLimit' });
    expect(sheet.lines[0].selected).toBeNull();
    expect(sheet.lines[0].calculatedRequirementSI).toBe(40000);
    expect(sheet.disclaimer).toMatch(/not a specification/i);
    const csv = procurementSheetCsv(sheet);
    expect(csv).toMatch(/PROCUREMENT REQUIRED/);
    expect(csv).toMatch(/DISCLAIMER/);
  });

  it('shows a selected part when sizing passed', () => {
    const lib = libWith(shackle('s1', 50000, 'manufacturerVerified'));
    const result = sizeComponent(lib, demand({ label: 'Rigging shackle' }));
    const sheet = buildProcurementSheet([result], { 'Rigging shackle': 'workingLoadLimit' });
    expect(sheet.lines[0].selected).not.toBeNull();
    expect(sheet.lines[0].selected!.verified).toBe(true);
  });
});
