/**
 * Milestone 8A — reduced-order brake stopping simulation.
 *
 * Validates the new, additive 1-DOF stop estimator against hand calculations
 * and the honesty rules: a constant brake force gives the analytic stopping
 * distance v²/(2a); extrapolation is clamped + flagged; force above the rating
 * is flagged; a stop that overruns the available stroke is reported.
 */
import { describe, it, expect } from 'vitest';
import { simulateBrakeStop } from '../calculations/brakeStopSim';
import type { BrakeCurve } from '../calculations/brakeCurves';

/** A flat displacement-force curve → constant braking force. */
function constantForceCurve(forceN: number): BrakeCurve {
  return {
    kind: 'displacementForce',
    abscissa: [0, 1000],
    force: [forceN, forceN],
    interpolation: 'linear',
  };
}

describe('brake stop — analytic agreement', () => {
  it('a constant force gives stopping distance v²/(2a)', () => {
    const mass = 1000;
    const force = 5000; // a = 5 m/s²
    const v = 10; // m/s
    const r = simulateBrakeStop({ massKg: mass, entrySpeedMps: v, curve: constantForceCurve(force) });
    expect(r.stopped).toBe(true);
    // v²/(2a) = 100 / 10 = 10 m; t = v/a = 2 s
    expect(r.stoppingDistanceM).toBeCloseTo(10, 1);
    expect(r.stoppingTimeS).toBeCloseTo(2, 1);
    expect(r.peakForceN).toBeCloseTo(5000, 5);
    expect(r.peakDecelerationMps2).toBeCloseTo(5, 2);
    // Brake work ≈ entry kinetic energy (no other resistance).
    expect(r.brakeEnergyJ).toBeCloseTo(r.entryKineticEnergyJ, -1);
  });

  it('is deterministic', () => {
    const input = { massKg: 900, entrySpeedMps: 12, curve: constantForceCurve(8000) };
    const a = simulateBrakeStop(input);
    const b = simulateBrakeStop(input);
    expect(a.stoppingDistanceM).toBe(b.stoppingDistanceM);
    expect(a.stoppingTimeS).toBe(b.stoppingTimeS);
  });
});

describe('brake stop — honesty rules', () => {
  it('clamps (never extrapolates) beyond the curve and flags it', () => {
    // Curve only defined up to 0.5 m stroke; the stop needs more stroke, so the
    // force is clamped at the last sample and the clamp is flagged.
    const curve: BrakeCurve = {
      kind: 'displacementForce',
      abscissa: [0, 0.5],
      force: [4000, 4000],
      interpolation: 'linear',
    };
    const r = simulateBrakeStop({ massKg: 1000, entrySpeedMps: 10, curve });
    expect(r.stopped).toBe(true);
    expect(r.warnings.some((w) => /clamped|sampled range/i.test(w))).toBe(true);
  });

  it('flags force above the entered rating', () => {
    const r = simulateBrakeStop({ massKg: 1000, entrySpeedMps: 10, curve: constantForceCurve(9000), ratingN: 5000 });
    expect(r.warnings.some((w) => /exceeds the entered rating/i.test(w))).toBe(true);
  });

  it('reports an overrun when the stop exceeds the available stroke', () => {
    // 10 m stop but only 4 m of stroke available.
    const r = simulateBrakeStop({ massKg: 1000, entrySpeedMps: 10, curve: constantForceCurve(5000), availableStrokeM: 4 });
    expect(r.withinStroke).toBe(false);
    expect(r.warnings.some((w) => /exceeds the available stroke|overrun/i.test(w))).toBe(true);
  });

  it('rejects a zero/negative mass or entry speed', () => {
    expect(simulateBrakeStop({ massKg: 0, entrySpeedMps: 10, curve: constantForceCurve(5000) }).warnings[0]).toMatch(/mass/i);
    expect(simulateBrakeStop({ massKg: 1000, entrySpeedMps: 0, curve: constantForceCurve(5000) }).warnings[0]).toMatch(/speed/i);
  });
});
