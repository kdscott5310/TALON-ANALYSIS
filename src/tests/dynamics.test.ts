/**
 * Milestone 3 — Trolley dynamics tests.
 *
 * Benchmarks are hand calculations documented inline:
 *  - straight-path geometry
 *  - frictionless energy conservation:      v² = 2·g·Δh
 *  - constant acceleration on a slope:      a = g·sinθ, S = ½·a·t²
 *  - constant-force brake stopping:         d = m·v₀²/(2F)
 *  - velocity-proportional decay:           v(t) = v₀·e^(−c·t/m)
 *  - rolling-resistance stopping:           d = v₀²/(2·C_rr·g)
 */
import { describe, it, expect } from 'vitest';
import { buildTrolleyPath, pathSlope } from '../calculations/trolleyPath';
import { simulateTrolley, type SimulationInput } from '../calculations/trolleyDynamics';
import { runDynamicsAnalysis } from '../calculations/dynamicsAnalysis';
import { exampleScenario } from '../models/exampleScenario';
import { GRAVITY } from '../units/units';

/** Straight path: no cable weight, no trolley load → pure chord. */
function straightPath(spanM: number, elevDiffM: number) {
  return buildTrolleyPath({
    spanM,
    elevDiffM,
    cableWeightNPerM: 0,
    horizontalTensionN: 1000,
    trolleyWeightN: 0,
  });
}

/** Baseline lossless simulation input on the given path. */
function losslessInput(path: ReturnType<typeof buildTrolleyPath>): SimulationInput {
  return {
    path,
    massKg: 100,
    rollingResistanceCoeff: 0,
    dragAreaM2: 0,
    airDensityKgPerM3: 1.225,
    alongTrackWindMps: 0,
    releaseSM: 0,
    releaseSpeedMps: 0,
    brakeStartSM: path.totalLengthM, // brake never meaningfully engages
    availableStrokeM: 1,
    brake: { law: 'constant-force', forceN: 0, rampLengthM: 1, velocityCoeffNsPerM: 0 },
    timeStepS: 0.01,
    maxSimTimeS: 60,
  };
}

describe('trolley path builder', () => {
  it('straight chord: length, slope, elevation change', () => {
    // L = 100 m, h = −20 m → chord length = √(100² + 20²) = 101.9804 m
    const p = straightPath(100, -20);
    expect(p.totalLengthM).toBeCloseTo(Math.sqrt(100 ** 2 + 20 ** 2), 3);
    expect(p.elevChangeM).toBeCloseTo(-20, 6);
    expect(p.slopeAtS(p.totalLengthM / 2)).toBeCloseTo(-0.2, 9);
    expect(p.hasUphillSegment).toBe(false);
  });

  it('sagged path midspan elevation: y(L/2) = h/2 − (w·L² )/(8H) − (P·L)/(4H)', () => {
    // L = 200, h = 0, w = 2 N/m, H = 5000 N, P = 1000 N
    // y(L/2) = −(2·200²)/(8·5000) − (1000·200)/(4·5000) = −2 − 10 = −12 m
    const p = buildTrolleyPath({
      spanM: 200,
      elevDiffM: 0,
      cableWeightNPerM: 2,
      horizontalTensionN: 5000,
      trolleyWeightN: 1000,
    });
    const sMid = p.sAtX(100);
    expect(p.yAtS(sMid)).toBeCloseTo(-12, 3);
  });

  it('detects locally uphill segments on level supports with sag', () => {
    const p = buildTrolleyPath({
      spanM: 200,
      elevDiffM: 0,
      cableWeightNPerM: 2,
      horizontalTensionN: 5000,
      trolleyWeightN: 1000,
    });
    expect(p.hasUphillSegment).toBe(true);
    expect(p.warnings.length).toBeGreaterThan(0);
  });

  it('analytic slope matches finite difference', () => {
    const args = [300, -60, 1.1, 11000, 1300] as const;
    const x = 120;
    const eps = 0.01;
    const num =
      ((): number => {
        const f = (xx: number) =>
          (args[1] / args[0]) * xx -
          (args[2] / (2 * args[3])) * xx * (args[0] - xx) -
          (args[4] / (args[3] * args[0])) * xx * (args[0] - xx);
        return (f(x + eps) - f(x - eps)) / (2 * eps);
      })();
    expect(pathSlope(x, ...args)).toBeCloseTo(num, 6);
  });

  it('rejects invalid inputs', () => {
    expect(() => straightPath(0, -10)).toThrow();
    expect(() =>
      buildTrolleyPath({
        spanM: 100,
        elevDiffM: -10,
        cableWeightNPerM: 1,
        horizontalTensionN: 0,
        trolleyWeightN: 100,
      }),
    ).toThrow();
  });
});

describe('trolley dynamics — frictionless benchmarks', () => {
  it('energy conservation: v_end² = 2·g·Δh (audit error < 1%)', () => {
    // Straight 100 m × −20 m path, no losses: v_end = √(2·9.80665·20) = 19.8058 m/s
    const path = straightPath(100, -20);
    const r = simulateTrolley(losslessInput(path));
    expect(r.termination).toBe('end-of-path');
    const vExpected = Math.sqrt(2 * GRAVITY * 20);
    expect(r.residualSpeedMps).toBeCloseTo(vExpected, 0);
    expect(Math.abs(r.residualSpeedMps - vExpected) / vExpected).toBeLessThan(0.005);
    expect(Math.abs(r.energy.auditErrorFrac)).toBeLessThan(0.01);
    expect(r.energy.brakeWorkJ).toBe(0);
    expect(r.energy.rollingWorkJ).toBe(0);
  });

  it('constant acceleration: a = g·sinθ and S = ½·a·t²', () => {
    // slope −0.2 → sinθ = 0.2/√1.04 = 0.196116 → a = 1.92338 m/s²
    // S = 101.9804 m → t = √(2S/a) = 10.2983 s
    const path = straightPath(100, -20);
    const r = simulateTrolley(losslessInput(path));
    const aExpected = (GRAVITY * 0.2) / Math.sqrt(1.04);
    expect(r.history.aMps2[1]).toBeCloseTo(aExpected, 3);
    const tExpected = Math.sqrt((2 * path.totalLengthM) / aExpected);
    expect(Math.abs(r.finalTimeS - tExpected)).toBeLessThan(0.05);
  });

  it('is deterministic for identical inputs', () => {
    const path = straightPath(100, -20);
    const a = simulateTrolley(losslessInput(path));
    const b = simulateTrolley(losslessInput(path));
    expect(a.finalSM).toBe(b.finalSM);
    expect(a.finalTimeS).toBe(b.finalTimeS);
    expect(a.peakSpeedMps).toBe(b.peakSpeedMps);
    expect(a.energy.auditErrorJ).toBe(b.energy.auditErrorJ);
  });
});

describe('trolley dynamics — brake benchmarks', () => {
  it('constant-force brake on a level path: d = m·v₀²/(2F), t = m·v₀/F', () => {
    // m = 100 kg, v₀ = 10 m/s, F = 500 N → a = −5 m/s², d = 10 m, t = 2 s
    // Brake work = ½·m·v₀² = 5000 J
    const path = straightPath(100, 0);
    const r = simulateTrolley({
      ...losslessInput(path),
      releaseSpeedMps: 10,
      brakeStartSM: 0,
      availableStrokeM: 50,
      brake: { law: 'constant-force', forceN: 500, rampLengthM: 50, velocityCoeffNsPerM: 0 },
    });
    expect(r.termination).toBe('stopped-in-brake-zone');
    expect(r.finalSM).toBeCloseTo(10, 1);
    expect(r.finalTimeS).toBeCloseTo(2, 1);
    expect(r.energy.brakeWorkJ).toBeCloseTo(5000, -1); // within ~5 J
    expect(r.peakBrakeForceN).toBeCloseTo(500, 6);
    expect(r.peakDecelMps2).toBeCloseTo(5, 2);
    expect(Math.abs(r.energy.auditErrorFrac)).toBeLessThan(0.01);
  });

  it('velocity-proportional brake: v(t) = v₀·e^(−c·t/m)', () => {
    // m = 100, c = 50 → v(2) = 10·e⁻¹ = 3.6788 m/s
    const path = straightPath(500, 0);
    const r = simulateTrolley({
      ...losslessInput(path),
      releaseSpeedMps: 10,
      brakeStartSM: 0,
      availableStrokeM: 500,
      brake: { law: 'velocity-proportional', forceN: 0, rampLengthM: 1, velocityCoeffNsPerM: 50 },
      timeStepS: 0.001,
      maxSimTimeS: 2,
    });
    expect(r.termination).toBe('time-limit');
    const vEnd = r.history.vMps[r.history.vMps.length - 1];
    expect(vEnd).toBeCloseTo(10 * Math.exp(-1), 3);
  });

  it('linear-ramp brake: force at half stroke equals half the peak', () => {
    const path = straightPath(100, 0);
    const r = simulateTrolley({
      ...losslessInput(path),
      releaseSpeedMps: 15,
      brakeStartSM: 0,
      availableStrokeM: 10,
      brake: { law: 'linear-ramp', forceN: 1000, rampLengthM: 10, velocityCoeffNsPerM: 0 },
      timeStepS: 0.001,
    });
    // find the recorded sample closest to stroke = 5 m
    let best = 0;
    for (let i = 0; i < r.history.sM.length; i++) {
      if (Math.abs(r.history.sM[i] - 5) < Math.abs(r.history.sM[best] - 5)) best = i;
    }
    expect(r.history.brakeForceN[best]).toBeCloseTo(500, 0);
  });

  it('rolling resistance only: d = v₀²/(2·C_rr·g)', () => {
    // v₀ = 10, C_rr = 0.02 → d = 100/(2·0.02·9.80665) = 254.93 m
    const path = straightPath(300, 0);
    const r = simulateTrolley({
      ...losslessInput(path),
      releaseSpeedMps: 10,
      rollingResistanceCoeff: 0.02,
    });
    expect(r.termination).toBe('stalled-before-brake');
    expect(r.finalSM).toBeCloseTo(100 / (2 * 0.02 * GRAVITY), 0);
  });

  it('reports a stopping failure when the brake is too weak', () => {
    // F = 100 N, m = 100 kg → a = −1 m/s²; stopping needs 200 m but only 50 m exist
    // residual v = √(v₀² − 2·a·d) = √(400 − 100) = 17.32 m/s
    const path = straightPath(50, 0);
    const r = simulateTrolley({
      ...losslessInput(path),
      releaseSpeedMps: 20,
      brakeStartSM: 0,
      availableStrokeM: 50,
      brake: { law: 'constant-force', forceN: 100, rampLengthM: 50, velocityCoeffNsPerM: 0 },
    });
    expect(r.termination).toBe('end-of-path');
    expect(r.residualSpeedMps).toBeCloseTo(Math.sqrt(300), 1);
    expect(r.warnings.some((w) => w.includes('STOPPING FAILURE'))).toBe(true);
  });

  it('tailwind increases the trolley speed', () => {
    const path = straightPath(100, -20);
    const base = { ...losslessInput(path), dragAreaM2: 0.5 };
    const calm = simulateTrolley(base);
    const tail = simulateTrolley({ ...base, alongTrackWindMps: 5 });
    expect(tail.residualSpeedMps).toBeGreaterThan(calm.residualSpeedMps);
  });
});

describe('trolley dynamics — numerics and error handling', () => {
  it('time-step sensitivity: halving dt changes results < 0.5%', () => {
    const path = straightPath(100, -20);
    const base = {
      ...losslessInput(path),
      dragAreaM2: 0.4,
      rollingResistanceCoeff: 0.015,
      brakeStartSM: 80,
      availableStrokeM: 25,
      brake: { law: 'constant-force' as const, forceN: 800, rampLengthM: 25, velocityCoeffNsPerM: 0 },
    };
    const coarse = simulateTrolley({ ...base, timeStepS: 0.01 });
    const fine = simulateTrolley({ ...base, timeStepS: 0.005 });
    expect(Math.abs(coarse.peakSpeedMps - fine.peakSpeedMps) / fine.peakSpeedMps).toBeLessThan(0.005);
    expect(Math.abs(coarse.finalSM - fine.finalSM) / fine.finalSM).toBeLessThan(0.005);
  });

  it('rejects invalid simulation inputs', () => {
    const path = straightPath(100, -20);
    expect(() => simulateTrolley({ ...losslessInput(path), massKg: 0 })).toThrow();
    expect(() => simulateTrolley({ ...losslessInput(path), timeStepS: 0 })).toThrow();
    expect(() => simulateTrolley({ ...losslessInput(path), releaseSM: 999 })).toThrow();
    expect(() => simulateTrolley({ ...losslessInput(path), releaseSpeedMps: -1 })).toThrow();
  });

  it('reports a stall when released with no net driving force', () => {
    const path = straightPath(100, 0); // level, from rest
    const r = simulateTrolley({ ...losslessInput(path), rollingResistanceCoeff: 0.02 });
    expect(r.termination).toBe('stalled-before-brake');
    expect(r.warnings.some((w) => w.includes('does not move'))).toBe(true);
  });
});

describe('dynamics analysis orchestrator (example scenario)', () => {
  it('runs the unverified example end to end with a bounded energy audit', () => {
    const r = runDynamicsAnalysis(exampleScenario);
    expect(r.sim.history.tS.length).toBeGreaterThan(10);
    expect(r.sim.peakSpeedMps).toBeGreaterThan(5);
    expect(r.sim.brakeEntrySpeedMps).not.toBeNull();
    expect(Math.abs(r.sim.energy.auditErrorFrac)).toBeLessThan(0.01);
    // brake either stops the trolley or produces a prominent failure warning
    const stopped = r.sim.termination === 'stopped-in-brake-zone';
    const flagged = r.warnings.some((w) => w.severity === 'critical');
    expect(stopped || flagged).toBe(true);
  });

  it('is deterministic and sorts warnings critical-first', () => {
    const a = runDynamicsAnalysis(exampleScenario);
    const b = runDynamicsAnalysis(exampleScenario);
    expect(a.sim.finalSM).toBe(b.sim.finalSM);
    expect(a.sim.peakSpeedMps).toBe(b.sim.peakSpeedMps);
    for (let i = 1; i < a.warnings.length; i++) {
      const order = { critical: 0, caution: 1, advisory: 2 } as const;
      expect(order[a.warnings[i - 1].severity]).toBeLessThanOrEqual(order[a.warnings[i].severity]);
    }
  });

  it('honors the release position setting', () => {
    const later = {
      ...exampleScenario,
      dynamics: { ...exampleScenario.dynamics, releasePositionFrac: 0.5 },
    };
    const a = runDynamicsAnalysis(exampleScenario);
    const b = runDynamicsAnalysis(later);
    expect(b.sim.brakeEntrySpeedMps ?? 0).toBeLessThan(a.sim.brakeEntrySpeedMps ?? 0);
  });
});
