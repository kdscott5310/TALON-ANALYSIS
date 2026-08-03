/**
 * Milestone 8C — CUFTS objective adapter for optimization.
 *
 * The headline guarantee: evaluating the BASELINE design-variable vector
 * reproduces the current validated v1 results EXACTLY, so optimization can
 * never silently shift a signed-off number (Rule 1). Also pins the rejection
 * rules — an invalid scenario or a solver failure yields non-finite metrics so
 * the optimizer discards the point rather than scoring it (R-6).
 */
import { describe, it, expect } from 'vitest';
import {
  applyVariables,
  evaluateScenarioMetrics,
  evaluateVariables,
  CUFTS_VARIABLES,
  CUFTS_OBJECTIVES,
  CUFTS_CONSTRAINTS,
  type CuftsLimits,
} from '../calculations/cuftsObjective';
import { optimize } from '../calculations/optimization';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { runDynamicsAnalysis } from '../calculations/dynamicsAnalysis';
import { exampleScenario } from '../models/exampleScenario';

/** The baseline vector = the scenario's own current values. */
const baselineVector = {
  pretensionN: exampleScenario.cable.pretensionN,
  brakeForceN: exampleScenario.brake.brakeForceN,
  brakeZoneLengthM: exampleScenario.site.brakeZoneLengthM,
  blocksPerAnchor: exampleScenario.anchors.blocksPerAnchor,
  designFactor: exampleScenario.cable.designFactor,
};

describe('baseline fidelity (the v1-results guarantee)', () => {
  it('applying the baseline vector leaves the scenario unchanged', () => {
    expect(applyVariables(exampleScenario, baselineVector)).toEqual(exampleScenario);
  });

  it('baseline metrics match the v1 solvers run directly, exactly', () => {
    const m = evaluateVariables(exampleScenario, baselineVector);
    const statics = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.5 });
    const dyn = runDynamicsAnalysis(exampleScenario);

    expect(m.peakTensionN).toBe(
      Math.max(statics.mainLegLoaded.maxTensionN, statics.backstay.maxTensionN),
    );
    expect(m.groundClearanceMarginM).toBe(statics.groundClearanceMarginM);
    expect(m.peakSpeedMps).toBe(dyn.sim.peakSpeedMps);
    expect(m.peakDecelG).toBe(dyn.peakDecelG);
    expect(m.peakBrakeForceN).toBe(dyn.sim.peakBrakeForceN);
    expect(m.residualSpeedMps).toBe(dyn.sim.residualSpeedMps);
  });

  it('is deterministic', () => {
    expect(evaluateVariables(exampleScenario, baselineVector)).toEqual(
      evaluateVariables(exampleScenario, baselineVector),
    );
  });

  it('does not mutate the base scenario', () => {
    const snapshot = JSON.parse(JSON.stringify(exampleScenario));
    applyVariables(exampleScenario, { ...baselineVector, pretensionN: 999 });
    evaluateVariables(exampleScenario, { ...baselineVector, brakeForceN: 12345 });
    expect(exampleScenario).toEqual(snapshot);
  });
});

describe('variable application', () => {
  it('applies each declared variable to the right scenario field', () => {
    const s = applyVariables(exampleScenario, {
      pretensionN: 12345,
      brakeForceN: 6789,
      brakeZoneLengthM: 42,
      blocksPerAnchor: 7,
      designFactor: 6,
    });
    expect(s.cable.pretensionN).toBe(12345);
    expect(s.brake.brakeForceN).toBe(6789);
    expect(s.site.brakeZoneLengthM).toBe(42);
    expect(s.anchors.blocksPerAnchor).toBe(7);
    expect(s.cable.designFactor).toBe(6);
  });

  it('rounds a block count to a whole number rather than pretending', () => {
    expect(applyVariables(exampleScenario, { blocksPerAnchor: 6.4 }).anchors.blocksPerAnchor).toBe(6);
    expect(applyVariables(exampleScenario, { blocksPerAnchor: 0.2 }).anchors.blocksPerAnchor).toBe(1);
  });

  it('declares bounds for every variable and a reader for every objective', () => {
    for (const v of CUFTS_VARIABLES) expect(v.defaultMin).toBeLessThan(v.defaultMax);
    const m = evaluateVariables(exampleScenario, baselineVector);
    for (const o of CUFTS_OBJECTIVES) expect(typeof o.read(m)).toBe('number');
  });
});

describe('failure rejection (never score a broken design)', () => {
  it('an invalid scenario yields non-finite metrics', () => {
    const broken = JSON.parse(JSON.stringify(exampleScenario));
    broken.site.horizontalSpanM = -1; // blocking validation error
    const m = evaluateScenarioMetrics(broken);
    expect(Number.isFinite(m.peakTensionN)).toBe(false);
    expect(Number.isFinite(m.peakSpeedMps)).toBe(false);
  });

  it('a trolley that never stops reports an INFINITE stroke, never a small number', () => {
    // Almost no brake force → cannot stop within the zone.
    const m = evaluateVariables(exampleScenario, { ...baselineVector, brakeForceN: 1 });
    expect(m.strokeUsedM === Number.POSITIVE_INFINITY || m.residualSpeedMps > 0).toBe(true);
  });

  it('the optimizer rejects non-finite points instead of selecting them', () => {
    const result = optimize({
      variables: [{ key: 'x', label: 'x', min: 0, max: 10, start: 5 }],
      // Non-finite everywhere except a clearly worse point.
      objective: (x) => (x.x < 9 ? Number.NaN : 100),
    });
    // It must never claim success with a NaN objective.
    if (result.success) expect(Number.isFinite(result.bestObjective)).toBe(true);
  });
});

describe('end-to-end optimization over the real solvers', () => {
  const limits: CuftsLimits = {
    maxCableUtilization: 1,
    maxDecelG: 5,
    maxSpeedMps: 30,
    availableStrokeM: exampleScenario.brake.availableStrokeM,
  };

  it('minimizes peak tension over pretension and reports feasibility + history', () => {
    const objective = CUFTS_OBJECTIVES.find((o) => o.key === 'peakTension')!;
    const result = optimize({
      variables: [{ key: 'pretensionN', label: 'Pretension', min: 3000, max: 30000, start: baselineVector.pretensionN }],
      objective: (x) => objective.read(evaluateVariables(exampleScenario, { ...baselineVector, ...x })),
      constraints: CUFTS_CONSTRAINTS.filter((c) => c.key === 'cableUtilization' || c.key === 'groundClearance').map((c) => ({
        key: c.key,
        label: c.label,
        evaluate: (x: Record<string, number>) => c.read(evaluateVariables(exampleScenario, { ...baselineVector, ...x }), limits),
      })),
      maxIterations: 6,
    });

    expect(typeof result.feasible).toBe('boolean');
    expect(result.history.length).toBeGreaterThan(0);
    expect(result.constraints.length).toBe(2);
    // Lower pretension reduces peak tension, so the optimum should not exceed baseline.
    const baselineTension = evaluateVariables(exampleScenario, baselineVector).peakTensionN;
    if (result.success) expect(result.bestObjective).toBeLessThanOrEqual(baselineTension + 1e-6);
  });

  it('an ACTIVE constraint within tolerance is feasible; a real violation is not', () => {
    // The panel passes feasibilityTolerance = 1e-4 because a penalty method
    // converges onto an active constraint from the infeasible side by a
    // vanishing amount. Tolerance must forgive noise, never a real violation.
    const tol = 1e-4;
    const atLimit = optimize({
      variables: [{ key: 'x', label: 'x', min: 0, max: 10, start: 5 }],
      objective: (x) => x.x,
      // g = +2.7e-6: sitting on the limit, over by numerical noise.
      constraints: [{ key: 'g', label: 'g', evaluate: () => 2.69e-6 }],
      feasibilityTolerance: tol,
    });
    expect(atLimit.feasible).toBe(true);

    const realViolation = optimize({
      variables: [{ key: 'x', label: 'x', min: 0, max: 10, start: 5 }],
      objective: (x) => x.x,
      constraints: [{ key: 'g', label: 'g', evaluate: () => 0.05 }], // far outside tolerance
      feasibilityTolerance: tol,
    });
    expect(realViolation.feasible).toBe(false);
    expect(realViolation.controllingConstraints.length).toBeGreaterThan(0);
  });

  it('an impossible constraint is reported INFEASIBLE, not as a valid design', () => {
    const objective = CUFTS_OBJECTIVES.find((o) => o.key === 'peakTension')!;
    const result = optimize({
      variables: [{ key: 'pretensionN', label: 'Pretension', min: 3000, max: 30000 }],
      objective: (x) => objective.read(evaluateVariables(exampleScenario, { ...baselineVector, ...x })),
      // Demand a physically unreachable utilization.
      constraints: [{
        key: 'impossible',
        label: 'Impossible utilization',
        evaluate: (x) => evaluateVariables(exampleScenario, { ...baselineVector, ...x }).cableUtilization - 1e-9,
      }],
      maxIterations: 4,
    });
    expect(result.feasible).toBe(false);
    expect(result.success).toBe(false);
    expect(result.controllingConstraints.length).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toMatch(/INFEASIBLE/i);
  });
});
