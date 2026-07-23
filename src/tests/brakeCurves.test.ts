/**
 * Milestone 10 — brake curves, interpolation, physics models, CSV import.
 *
 * Focus: interpolation is exact between samples and CLAMPS (never extrapolates)
 * outside the range with a warning; the hydraulic and eddy-current models match
 * their closed forms; CSV import preserves the raw text and rejects bad data.
 */
import { describe, it, expect } from 'vitest';
import {
  eddyCurrentForce,
  evaluateBrakeCurve,
  hydraulicOrificeForce,
  importBrakeCurveCsv,
  interpolateCurve,
  validateCurve,
  type BrakeCurve,
} from '../calculations/brakeCurves';

function curve(over: Partial<BrakeCurve> = {}): BrakeCurve {
  return {
    kind: 'displacementForce',
    abscissa: [0, 1, 2, 3],
    force: [0, 100, 400, 900],
    interpolation: 'linear',
    ...over,
  };
}

describe('curve validation', () => {
  it('accepts a strictly increasing curve', () => {
    expect(validateCurve(curve()).ok).toBe(true);
  });

  it('rejects non-increasing abscissa and mismatched lengths', () => {
    expect(validateCurve(curve({ abscissa: [0, 1, 1, 2] })).ok).toBe(false);
    expect(validateCurve(curve({ abscissa: [0, 1] })).ok).toBe(false);
  });

  it('warns about negative force samples', () => {
    const v = validateCurve(curve({ force: [0, -50, 400, 900] }));
    expect(v.warnings.join(' ')).toMatch(/negative/i);
  });
});

describe('interpolation clamps rather than extrapolating (Rule 2)', () => {
  it('interpolates exactly between samples', () => {
    expect(interpolateCurve(curve(), 1.5).force).toBeCloseTo(250, 9); // midpoint of 100,400
    expect(interpolateCurve(curve(), 0).force).toBe(0);
    expect(interpolateCurve(curve(), 2).force).toBe(400);
  });

  it('clamps below the range and flags it', () => {
    const r = interpolateCurve(curve(), -5);
    expect(r.force).toBe(0);
    expect(r.extrapolated).toBe(true);
    expect(r.clampedFrom).toBe('below');
  });

  it('clamps above the range and flags it', () => {
    const r = interpolateCurve(curve(), 10);
    expect(r.force).toBe(900); // held at the last sample, NOT extrapolated to higher
    expect(r.extrapolated).toBe(true);
    expect(r.clampedFrom).toBe('above');
  });

  it('does not flag exact endpoints as extrapolated', () => {
    expect(interpolateCurve(curve(), 0).extrapolated).toBe(false);
    expect(interpolateCurve(curve(), 3).extrapolated).toBe(false);
  });
});

describe('evaluateBrakeCurve selects the axis and warns', () => {
  it('uses stroke for displacement curves and warns on out-of-range', () => {
    const r = evaluateBrakeCurve(curve(), { strokeM: 5, speedMps: 10, timeS: 1 });
    expect(r.forceN).toBe(900);
    expect(r.warnings.join(' ')).toMatch(/clamped to the nearest endpoint/i);
    expect(r.warnings.join(' ')).toMatch(/NOT extrapolated/i);
  });

  it('uses velocity for velocity–force curves', () => {
    const vf = curve({ kind: 'velocityForce', abscissa: [0, 5, 10], force: [0, 500, 1000] });
    const r = evaluateBrakeCurve(vf, { strokeM: 0, speedMps: 2.5, timeS: 0 });
    expect(r.forceN).toBeCloseTo(250, 9);
  });

  it('uses time for time–force curves', () => {
    const tf = curve({ kind: 'timeForce', abscissa: [0, 1, 2], force: [0, 800, 800] });
    const r = evaluateBrakeCurve(tf, { strokeM: 0, speedMps: 0, timeS: 0.5 });
    expect(r.forceN).toBeCloseTo(400, 9);
  });

  it('warns when the force exceeds the entered rating', () => {
    const r = evaluateBrakeCurve(curve(), { strokeM: 3, speedMps: 0, timeS: 0 }, 500);
    expect(r.forceN).toBe(900);
    expect(r.warnings.join(' ')).toMatch(/exceeds the entered rating/i);
  });
});

describe('hydraulic orifice model', () => {
  it('force rises with the square of speed', () => {
    const input = { pistonAreaM2: 0.01, orificeAreaM2: 1e-4, fluidDensityKgPerM3: 870, preloadN: 0 };
    const f1 = hydraulicOrificeForce(input, 1);
    const f2 = hydraulicOrificeForce(input, 2);
    expect(f2 / f1).toBeCloseTo(4, 6); // quadratic
    // Closed form: F = ½·ρ·Ap·(Ap/Ao)²·v²
    const expected = 0.5 * 870 * 0.01 * (0.01 / 1e-4) ** 2 * 1;
    expect(f1).toBeCloseTo(expected, 3);
  });

  it('adds the preload and returns NaN for invalid areas', () => {
    expect(hydraulicOrificeForce({ pistonAreaM2: 0.01, orificeAreaM2: 1e-4, preloadN: 500 }, 0)).toBe(500);
    expect(Number.isNaN(hydraulicOrificeForce({ pistonAreaM2: 0, orificeAreaM2: 1e-4 }, 1))).toBe(true);
  });
});

describe('eddy-current model', () => {
  const input = { lowSpeedCoefficientNsPerM: 200, peakSpeedMps: 10, referenceGapM: 0.005, gapM: 0.005 };

  it('is roughly linear at low speed and falls off past the peak', () => {
    const low = eddyCurrentForce(input, 1);
    expect(low).toBeCloseTo((200 * 1) / (1 + (1 / 10) ** 2), 6);
    // Force at very high speed is below the near-peak force (falloff).
    const nearPeak = eddyCurrentForce(input, 10);
    const high = eddyCurrentForce(input, 40);
    expect(high).toBeLessThan(nearPeak);
  });

  it('scales with 1/gap²', () => {
    const wide = eddyCurrentForce({ ...input, gapM: 0.010 }, 5); // double gap
    const narrow = eddyCurrentForce({ ...input, gapM: 0.005 }, 5);
    expect(narrow / wide).toBeCloseTo(4, 6); // (0.010/0.005)² = 4
  });

  it('returns NaN for invalid gap or peak speed', () => {
    expect(Number.isNaN(eddyCurrentForce({ ...input, gapM: 0 }, 5))).toBe(true);
    expect(Number.isNaN(eddyCurrentForce({ ...input, peakSpeedMps: 0 }, 5))).toBe(true);
  });
});

describe('measured CSV import', () => {
  it('parses a two-column CSV, preserves raw text, and sorts by abscissa', () => {
    const text = 'stroke_m,force_N\n0,0\n0.5,600\n0.25,300\n1.0,900';
    const r = importBrakeCurveCsv(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.curve.abscissa).toEqual([0, 0.25, 0.5, 1.0]); // sorted
    expect(r.curve.force).toEqual([0, 300, 600, 900]);
    expect(r.curve.rawText).toBe(text); // Rule 5: original preserved
    expect(r.curve.source).toBe('measured');
  });

  it('handles a header-less numeric CSV', () => {
    const r = importBrakeCurveCsv('0,0\n1,500');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.curve.abscissa).toEqual([0, 1]);
  });

  it('rejects duplicate abscissae and non-numeric rows', () => {
    expect(importBrakeCurveCsv('x,f\n0,0\n0,500').ok).toBe(false);
    expect(importBrakeCurveCsv('x,f\n0,0\n1,abc').ok).toBe(false);
    expect(importBrakeCurveCsv('x,f\n0,0').ok).toBe(false); // too few rows
  });

  it('imported curves interpolate and clamp like any other', () => {
    const r = importBrakeCurveCsv('s,f\n0,0\n1,1000');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(interpolateCurve(r.curve, 0.5).force).toBeCloseTo(500, 9);
    expect(interpolateCurve(r.curve, 2).clampedFrom).toBe('above');
  });
});
