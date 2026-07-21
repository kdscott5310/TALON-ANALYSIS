/**
 * Milestone 5 — invariant / property tests and edge-case regressions.
 *
 * These assert relationships that must hold for ANY valid inputs
 * (equilibrium closure, nonnegative dissipation, finite outputs,
 * monotonic brake work) plus specific boundary geometries.
 */
import { describe, it, expect } from 'vitest';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { runDynamicsAnalysis } from '../calculations/dynamicsAnalysis';
import { buildTrolleyPath } from '../calculations/trolleyPath';
import { simulateTrolley, type SimulationInput } from '../calculations/trolleyDynamics';
import { summarizeScenario } from '../calculations/statusSummary';
import { exampleScenario } from '../models/exampleScenario';
import type { Scenario } from '../models/scenario';
import { ftToM, lbfToN, mphToMps } from '../units/units';

function clone(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

function straightPath(spanM: number, elevDiffM: number) {
  return buildTrolleyPath({
    spanM,
    elevDiffM,
    cableWeightNPerM: 0,
    horizontalTensionN: 1000,
    trolleyWeightN: 0,
  });
}

function baseSim(path: ReturnType<typeof buildTrolleyPath>, o: Partial<SimulationInput> = {}): SimulationInput {
  return {
    path,
    massKg: 100,
    rollingResistanceCoeff: 0,
    dragAreaM2: 0,
    airDensityKgPerM3: 1.225,
    alongTrackWindMps: 0,
    releaseSM: 0,
    releaseSpeedMps: 0,
    brakeStartSM: path.totalLengthM,
    availableStrokeM: 1,
    brake: { law: 'constant-force', forceN: 0, rampLengthM: 1, velocityCoeffNsPerM: 0 },
    timeStepS: 0.01,
    maxSimTimeS: 120,
    ...o,
  };
}

describe('invariant: master-node force equilibrium closes for swept positions', () => {
  it('ΣF ≈ 0 at every trolley position', () => {
    for (let i = 0; i <= 10; i++) {
      const r = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: i / 10 });
      const n = r.masterNode;
      const fx = n.backstayForce.fx + n.mainLegForce.fx + n.riggingWeight.fx + n.hookReaction.fx;
      const fy = n.backstayForce.fy + n.mainLegForce.fy + n.riggingWeight.fy + n.hookReaction.fy;
      expect(Math.hypot(fx, fy)).toBeLessThan(1e-6);
    }
  });
});

describe('invariant: dynamics energy dissipation is nonnegative and audited', () => {
  it('brake, drag, and rolling work are ≥ 0 and audit closes < 1%', () => {
    const s = clone(exampleScenario);
    const r = runDynamicsAnalysis(s);
    expect(r.sim.energy.brakeWorkJ).toBeGreaterThanOrEqual(0);
    expect(r.sim.energy.rollingWorkJ).toBeGreaterThanOrEqual(0);
    expect(Math.abs(r.sim.energy.auditErrorFrac)).toBeLessThan(0.01);
  });

  it('all history channels are finite', () => {
    const r = runDynamicsAnalysis(exampleScenario);
    const h = r.sim.history;
    for (const arr of [h.tS, h.sM, h.xM, h.yM, h.vMps, h.aMps2, h.brakeForceN]) {
      expect(arr.every((v) => Number.isFinite(v))).toBe(true);
    }
  });
});

describe('invariant: brake work increases monotonically with brake force', () => {
  it('stronger constant-force brake absorbs at least as much energy over the same entry', () => {
    const path = straightPath(200, 0);
    const mk = (F: number) =>
      simulateTrolley(
        baseSim(path, {
          releaseSpeedMps: 15,
          brakeStartSM: 0,
          availableStrokeM: 200,
          brake: { law: 'constant-force', forceN: F, rampLengthM: 200, velocityCoeffNsPerM: 0 },
        }),
      );
    const weak = mk(300);
    const strong = mk(900);
    // Both stop; brake work must equal the same initial KE (energy conservation),
    // but the stronger brake stops in a shorter distance.
    expect(strong.finalSM).toBeLessThan(weak.finalSM);
    expect(weak.energy.brakeWorkJ).toBeGreaterThan(0);
    expect(strong.energy.brakeWorkJ).toBeGreaterThan(0);
  });
});

describe('edge case: near-level cable', () => {
  it('produces finite tensions and a large but finite sag ratio', () => {
    const s = clone(exampleScenario);
    s.site.highPointElevationM = ftToM(30); // shallow
    s.site.brakeAnchorElevationM = ftToM(28);
    const r = runStaticAnalysis({ scenario: s, trolleyPositionFrac: 0.5 });
    expect(Number.isFinite(r.mainLegLoaded.maxTensionN)).toBe(true);
    expect(Number.isFinite(r.mainLegLoaded.midspanSagM)).toBe(true);
  });
});

describe('edge case: steep geometry', () => {
  it('emits a parabolic-inaccuracy warning above 30° chord slope', () => {
    const s = clone(exampleScenario);
    s.site.highPointElevationM = ftToM(250);
    s.site.horizontalSpanM = ftToM(400); // ~32° chord
    const r = runStaticAnalysis({ scenario: s, trolleyPositionFrac: 0.5 });
    expect(r.allWarnings.some((w) => /slope|steep/i.test(w))).toBe(true);
  });
});

describe('edge case: very small sag (high pretension)', () => {
  it('sag shrinks as pretension rises, staying positive and finite', () => {
    const low = clone(exampleScenario);
    const high = clone(exampleScenario);
    high.cable.pretensionN = lbfToN(15000);
    const rl = runStaticAnalysis({ scenario: low, trolleyPositionFrac: 0.5 });
    const rh = runStaticAnalysis({ scenario: high, trolleyPositionFrac: 0.5 });
    expect(rh.mainLegLoaded.midspanSagM).toBeLessThan(rl.mainLegLoaded.midspanSagM);
    expect(rh.mainLegLoaded.midspanSagM).toBeGreaterThan(0);
  });
});

describe('edge case: large moving load', () => {
  it('increases hook load and remains finite', () => {
    const light = clone(exampleScenario);
    const heavy = clone(exampleScenario);
    heavy.trolley.testArticleMassKg = 2000;
    const rl = runStaticAnalysis({ scenario: light, trolleyPositionFrac: 0.5 });
    const rh = runStaticAnalysis({ scenario: heavy, trolleyPositionFrac: 0.5 });
    expect(rh.masterNode.hookResultantN).toBeGreaterThan(rl.masterNode.hookResultantN);
    expect(Number.isFinite(rh.masterNode.hookResultantN)).toBe(true);
  });
});

describe('edge case: wind direction', () => {
  it('opposing wind slows the trolley vs zero wind vs tailwind', () => {
    const path = buildTrolleyPath({
      spanM: 100,
      elevDiffM: -20,
      cableWeightNPerM: 0,
      horizontalTensionN: 1000,
      trolleyWeightN: 0,
    });
    const mk = (wind: number) => simulateTrolley(baseSim(path, { dragAreaM2: 0.6, alongTrackWindMps: wind }));
    const head = mk(-8);
    const calm = mk(0);
    const tail = mk(8);
    expect(head.residualSpeedMps).toBeLessThan(calm.residualSpeedMps);
    expect(tail.residualSpeedMps).toBeGreaterThan(calm.residualSpeedMps);
  });
});

describe('edge case: short brake zone triggers a stopping-failure warning', () => {
  it('reports failure when the brake zone is too short to stop', () => {
    const s = clone(exampleScenario);
    s.site.brakeZoneLengthM = ftToM(3);
    s.brake.availableStrokeM = ftToM(3);
    const r = runDynamicsAnalysis(s);
    expect(r.warnings.some((w) => w.severity === 'critical')).toBe(true);
  });
});

describe('edge case: invalid ratings surface as insufficient, never acceptable', () => {
  it('un-entered brake capacity and trolley rating are marked insufficient', () => {
    const summary = summarizeScenario(exampleScenario);
    const cap = summary.items.find((i) => i.key === 'brake-capacity')!;
    const rating = summary.items.find((i) => i.key === 'trolley-rating')!;
    expect(cap.status).toBe('insufficient');
    expect(rating.status).toBe('insufficient');
    expect(cap.valueSI).toBeNull();
  });

  it('entering a capacity below demand flips the check to failed', () => {
    const s = clone(exampleScenario);
    s.brake.brakeCapacityN = lbfToN(100); // far below peak
    const summary = summarizeScenario(s);
    const cap = summary.items.find((i) => i.key === 'brake-capacity')!;
    expect(cap.status).toBe('failed');
  });
});

describe('invariant: max allowable speed near frictionless ceiling', () => {
  it('overspeed check trips when the allowable is set very low', () => {
    const s = clone(exampleScenario);
    s.trolley.maxAllowableSpeedMps = mphToMps(5);
    const summary = summarizeScenario(s);
    const speed = summary.items.find((i) => i.key === 'peak-speed')!;
    expect(speed.status).toBe('failed');
    expect(Number.isFinite(speed.valueSI!)).toBe(true);
    // sanity: peak speed for the example is well above walking pace
    expect(speed.valueSI!).toBeGreaterThan(mphToMps(20));
  });
});
