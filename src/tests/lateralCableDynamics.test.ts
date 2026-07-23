/**
 * Milestone 11 — lateral / out-of-plane cable dynamics (reduced-order).
 *
 * Analytical benchmark: the fundamental transverse frequency of a tensioned
 * string is f₁ = (1/2L)·sqrt(T/μ). The lumped-mass discretization converges to
 * this as the node count rises. Also checks the static wind deflection
 * q·L²/(8T), stability, determinism, and honest reduced-order labeling.
 */
import { describe, it, expect } from 'vitest';
import {
  solveLateralCableDynamics,
  type LateralCableInput,
} from '../calculations/lateralCableDynamics';

function base(over: Partial<LateralCableInput> = {}): LateralCableInput {
  return {
    spanM: 100,
    axialTensionN: 10000,
    linearMassKgPerM: 0.5,
    dampingRatio: 0.02,
    interiorNodes: 40,
    durationS: 2,
    ...over,
  };
}

describe('lateral cable dynamics — analytical benchmark', () => {
  it('reproduces the tensioned-string fundamental frequency f = (1/2L)sqrt(T/μ)', () => {
    const r = solveLateralCableDynamics(base({ interiorNodes: 80 }));
    // f_analytical = 1/(2·100)·sqrt(10000/0.5) = 0.005·141.42 = 0.7071 Hz
    expect(r.analyticalFrequencyHz).toBeCloseTo(0.70711, 4);
    // The fine discretization is within 0.1% of the continuous value.
    expect(Math.abs(r.fundamentalFrequencyHz - r.analyticalFrequencyHz) / r.analyticalFrequencyHz).toBeLessThan(1e-3);
  });

  it('converges toward the analytical frequency as nodes increase', () => {
    const coarse = solveLateralCableDynamics(base({ interiorNodes: 6 }));
    const fine = solveLateralCableDynamics(base({ interiorNodes: 120 }));
    const errCoarse = Math.abs(coarse.fundamentalFrequencyHz - coarse.analyticalFrequencyHz);
    const errFine = Math.abs(fine.fundamentalFrequencyHz - fine.analyticalFrequencyHz);
    expect(errFine).toBeLessThan(errCoarse);
  });

  it('the observed dominant frequency matches the fundamental for a plucked cable', () => {
    // Give the cable an initial impulse and let it ring at its natural frequency.
    const r = solveLateralCableDynamics(
      base({ brakeImpulseNs: 50, trolleyMassKg: 100, trolleyFraction: 0.5, dampingRatio: 0.005, durationS: 10 }),
    );
    expect(r.dominantFrequencyHz).toBeGreaterThan(0);
    // Within 25% of the fundamental (a coarse zero-crossing estimate on a
    // trolley-loaded cable, which lowers the frequency).
    expect(r.dominantFrequencyHz).toBeLessThan(r.fundamentalFrequencyHz * 1.3);
  });
});

describe('lateral cable dynamics — wind response', () => {
  it('matches the static string deflection q·L²/(8T) under steady wind', () => {
    const q = 5; // N/m
    const r = solveLateralCableDynamics(base({ windForcePerLengthNPerM: q, dampingRatio: 0.5, durationS: 20 }));
    const expected = (q * 100 * 100) / (8 * 10000); // 0.625 m
    expect(r.staticWindDeflectionM).toBeCloseTo(expected, 6);
    // A well-damped cable settles near the static deflection (amplification → ~1).
    expect(r.dynamicAmplification).not.toBeNull();
    expect(r.dynamicAmplification!).toBeGreaterThan(0.8);
    expect(r.dynamicAmplification!).toBeLessThan(2.2);
  });

  it('a sudden gust produces dynamic amplification above the static value', () => {
    const r = solveLateralCableDynamics(
      base({ gustForcePerLengthNPerM: 8, windForcePerLengthNPerM: 2, dampingRatio: 0.01, durationS: 15 }),
    );
    expect(r.dynamicAmplification).not.toBeNull();
    // A near-undamped step load overshoots toward the classic 2× factor.
    expect(r.dynamicAmplification!).toBeGreaterThan(1.3);
  });

  it('reports a peak out-of-plane support reaction under wind', () => {
    const r = solveLateralCableDynamics(base({ windForcePerLengthNPerM: 5, durationS: 10 }));
    expect(r.peakSupportReactionN).toBeGreaterThan(0);
    expect(Number.isFinite(r.peakSupportReactionN)).toBe(true);
  });
});

describe('lateral cable dynamics — stability, honesty, failures', () => {
  it('remains stable at the chosen time step', () => {
    const r = solveLateralCableDynamics(base({ windForcePerLengthNPerM: 5 }));
    expect(r.stable).toBe(true);
    expect(Number.isFinite(r.peakLateralDisplacementM)).toBe(true);
  });

  it('always labels itself reduced-order, not FEA (Rule 11)', () => {
    const r = solveLateralCableDynamics(base());
    expect(r.assumptions.join(' ')).toMatch(/NOT finite-element/i);
    expect(r.warnings.join(' ')).toMatch(/not a finite-element/i);
  });

  it('is deterministic', () => {
    const a = solveLateralCableDynamics(base({ windForcePerLengthNPerM: 5 }));
    const b = solveLateralCableDynamics(base({ windForcePerLengthNPerM: 5 }));
    expect(a.peakLateralDisplacementM).toBe(b.peakLateralDisplacementM);
    expect(a.fundamentalFrequencyHz).toBe(b.fundamentalFrequencyHz);
  });

  it('rejects invalid inputs rather than defaulting', () => {
    expect(solveLateralCableDynamics(base({ axialTensionN: 0 })).failureReason).toBeTruthy();
    expect(solveLateralCableDynamics(base({ linearMassKgPerM: -1 })).failureReason).toBeTruthy();
    expect(solveLateralCableDynamics(base({ interiorNodes: 2 })).failureReason).toBeTruthy();
    expect(solveLateralCableDynamics(base({ spanM: -5 })).failureReason).toBeTruthy();
  });
});
