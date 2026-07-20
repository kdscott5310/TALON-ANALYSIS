import { describe, expect, it } from 'vitest';
import { validateScenario } from '../validation/validate';
import { exampleScenario } from '../models/exampleScenario';
import { computeLayout, depressionAngleDeg, chordLength } from '../calculations/layoutGeometry';
import { ftToM } from '../units/units';
import type { Scenario } from '../models/scenario';

const clone = (): Scenario => JSON.parse(JSON.stringify(exampleScenario));

describe('validateScenario — example scenario', () => {
  it('accepts the example scenario with no errors', () => {
    const r = validateScenario(exampleScenario);
    expect(r.isValid).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});

describe('validateScenario — error cases', () => {
  it('rejects non-positive span', () => {
    const s = clone();
    s.site.horizontalSpanM = 0;
    const r = validateScenario(s);
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.field === 'site.horizontalSpanM' && i.severity === 'error')).toBe(true);
  });

  it('rejects NaN elevation', () => {
    const s = clone();
    s.site.highPointElevationM = NaN;
    expect(validateScenario(s).isValid).toBe(false);
  });

  it('rejects hook height below high point', () => {
    const s = clone();
    s.crane.hookHeightM = s.site.highPointElevationM - 1;
    const r = validateScenario(s);
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.field === 'crane.hookHeightM')).toBe(true);
  });

  it('rejects brake zone longer than span', () => {
    const s = clone();
    s.site.brakeZoneLengthM = s.site.horizontalSpanM + 1;
    expect(validateScenario(s).isValid).toBe(false);
  });

  it('rejects dynamic amplification below 1', () => {
    const s = clone();
    s.crane.dynamicAmplificationFactor = 0.9;
    expect(validateScenario(s).isValid).toBe(false);
  });

  it('rejects negative pretension', () => {
    const s = clone();
    s.cable.pretensionN = -100;
    expect(validateScenario(s).isValid).toBe(false);
  });
});

describe('validateScenario — warning cases (non-blocking)', () => {
  it('warns on span outside preliminary range but remains valid', () => {
    const s = clone();
    s.site.horizontalSpanM = ftToM(2500);
    const r = validateScenario(s);
    expect(r.isValid).toBe(true);
    expect(r.issues.some((i) => i.field === 'site.horizontalSpanM' && i.severity === 'warning')).toBe(true);
  });

  it('warns on design factor below 5', () => {
    const s = clone();
    s.cable.designFactor = 3;
    const r = validateScenario(s);
    expect(r.isValid).toBe(true);
    expect(r.issues.some((i) => i.field === 'cable.designFactor')).toBe(true);
  });
});

describe('layout geometry', () => {
  // Hand benchmark: 200 ft high point over 1,000 ft span
  //   nominal angle = atan(200/1000) = 11.3099 deg
  //   chord = sqrt(1000^2 + 200^2) = 1019.804 ft
  it('matches the hand-calculated nominal angle and chord', () => {
    const layout = computeLayout(exampleScenario.site);
    expect(layout.mainLegNominalAngleDeg).toBeCloseTo(11.3099, 3);
    expect(layout.mainLegChordLengthM).toBeCloseTo(ftToM(1019.8039), 2);
  });

  it('computes depression angle for known triangles', () => {
    expect(depressionAngleDeg({ x: 0, y: 100 }, { x: 100, y: 0 })).toBeCloseTo(45, 10);
    expect(depressionAngleDeg({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(depressionAngleDeg({ x: 0, y: 50 }, { x: 0, y: 0 })).toBe(90);
  });

  it('computes chord length (3-4-5 triangle)', () => {
    expect(chordLength({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 12);
  });

  it('positions the brake-zone start inside the span', () => {
    const layout = computeLayout(exampleScenario.site);
    expect(layout.brakeZoneStartX).toBeLessThan(layout.brakeAnchor.x);
    expect(layout.brakeZoneStartX).toBeGreaterThan(layout.masterNode.x);
  });
});
