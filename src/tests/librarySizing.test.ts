/**
 * Milestone 7D — sizing & candidate selection over the library.
 *
 * The sizing engine is unit-tested elsewhere; these tests pin the honesty rules
 * as exercised against real seed data and the wiring the UI relies on: seeds
 * evaluate but are excluded when verified data is required, a missing rating is
 * insufficient (never adequate), candidates rank by margin (largest first — not
 * the smallest passing), and published vs derated ratings stay separate.
 */
import { describe, it, expect } from 'vitest';
import { sizeComponent } from '../calculations/componentSizing';
import { buildSeedLibrary } from '../core/library/seedLibrary';
import { createLibrary, mergeRecord, type ComponentLibrary, type ComponentRecord } from '../core/library/componentLibrary';
import { blankRecord } from '../core/library/recordEdits';
import { quantity } from '../core/provenance';

const seeds = buildSeedLibrary();

describe('sizing over seed data', () => {
  it('evaluates an example rope but its margin/rating are reported honestly', () => {
    const r = sizeComponent(seeds, {
      label: 'Main line', category: 'syntheticRope', ratingKey: 'minimumBreakingStrength',
      demand: 10000, designFactor: 5, // required 50000
    });
    expect(r.requiredRating).toBe(50000);
    const rope = r.allCandidates.find((c) => c.recordId === 'seed-synthetic-rope-12mm')!;
    expect(rope.publishedRating).toBe(130000);
    expect(rope.status).toBe('pass');
    expect(rope.margin).toBeCloseTo(2.6, 5);
    expect(r.anyPass).toBe(true);
  });

  it('excludes example-only seeds when verified data is required', () => {
    const r = sizeComponent(seeds, {
      label: 'Main line', category: 'syntheticRope', ratingKey: 'minimumBreakingStrength',
      demand: 10000, designFactor: 5, requireVerified: true,
    });
    expect(r.anyPass).toBe(false);
    expect(r.allCandidates.every((c) => c.status === 'excludedUnverified')).toBe(true);
  });

  it('a missing rating property is insufficient information, never adequate', () => {
    const r = sizeComponent(seeds, {
      label: 'Main line', category: 'syntheticRope', ratingKey: 'workingLoadLimit', // rope has no WLL
      demand: 10000, designFactor: 5,
    });
    const rope = r.allCandidates.find((c) => c.recordId === 'seed-synthetic-rope-12mm')!;
    expect(rope.status).toBe('insufficientInformation');
    expect(rope.deratedRating).toBeNull();
  });
});

describe('ranking never prefers the smallest passing part', () => {
  function shackle(id: string, wll: number): ComponentRecord {
    return {
      ...blankRecord({ id, category: 'shackle', name: id, state: 'userVerified' }),
      properties: [{ key: 'workingLoadLimit', label: 'WLL', quantity: quantity(wll, 'force', 'userVerified') }],
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

  it('ranks passing candidates by margin, largest first', () => {
    const lib = libOf(shackle('small', 60000), shackle('big', 120000));
    const r = sizeComponent(lib, {
      label: 'Sling', category: 'shackle', ratingKey: 'workingLoadLimit',
      demand: 10000, designFactor: 5, // required 50000; both pass
    });
    expect(r.passing.map((c) => c.recordId)).toEqual(['big', 'small']); // largest margin first
    expect(r.passing[0].margin! > r.passing[1].margin!).toBe(true);
  });
});

describe('derating keeps the published rating separate (Rule 5)', () => {
  it('applies a derating to the published rating without discarding it', () => {
    const lib = (() => {
      const out = mergeRecord(createLibrary('t'), {
        ...blankRecord({ id: 'rope', category: 'cable', name: 'Rope', state: 'userVerified' }),
        properties: [{ key: 'minimumBreakingStrength', label: 'MBS', quantity: quantity(100000, 'force', 'userVerified') }],
      });
      if (!out.ok) throw new Error(out.reason);
      return out.library;
    })();
    const r = sizeComponent(lib, {
      label: 'Line', category: 'cable', ratingKey: 'minimumBreakingStrength',
      demand: 10000, designFactor: 5, deratings: { temperature: 0.8 }, // required 50000; derated 80000
    });
    const c = r.allCandidates[0];
    expect(c.publishedRating).toBe(100000);
    expect(c.deratedRating).toBe(80000);
    expect(c.status).toBe('pass');
  });
});
