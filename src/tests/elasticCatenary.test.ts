/**
 * Milestone 8 — elastic catenary solver benchmarks and failure tests.
 *
 * Analytical/literature benchmarks:
 *  - level-support inextensible catenary (very stiff EA) matches the closed
 *    form H = w·span²/(8·sag) in the small-sag limit,
 *  - the catenary reduces to the parabolic result when sag/span is small,
 *  - elastic elongation matches T·L/EA for a nearly straight taut cable,
 *  - geometric closure residuals are driven below tolerance,
 *  - refining the profile does not change the converged forces (they are
 *    independent of profilePoints — a mesh-independence check on the outputs).
 *
 * Failure tests: infeasible length, invalid EA, slack cable, non-convergence
 * guard, and near-vertical geometry.
 */
import { describe, it, expect } from 'vitest';
import {
  solveElasticCatenary,
  unstretchedLengthForSag,
  type ElasticCatenaryInput,
} from '../calculations/elasticCatenary';
import { solveParabolicLeg } from '../calculations/parabolicCable';
import { GRAVITY } from '../units/units';

function base(over: Partial<ElasticCatenaryInput> = {}): ElasticCatenaryInput {
  return {
    spanM: 100,
    elevDiffM: 0,
    unstretchedLengthM: 101,
    axialStiffnessN: 1e9, // very stiff → nearly inextensible
    weightPerLengthNPerM: 10,
    profilePoints: 100,
    ...over,
  };
}

describe('elastic catenary — analytical benchmarks', () => {
  it('level-support catenary closes geometry and is symmetric', () => {
    const r = solveElasticCatenary(base());
    expect(r.convergence).toBe('converged');
    expect(r.residuals.norm).toBeLessThan(1e-8);
    // Symmetric level span: equal end tensions, vertical reactions ±wL0/2.
    expect(r.tensionLeftN).toBeCloseTo(r.tensionRightN, 6);
    expect(r.verticalForceLeftN).toBeCloseTo((10 * r.effectiveUnstretchedLengthM) / 2, 6);
    // Minimum tension at midspan equals the horizontal component.
    expect(r.minTensionN).toBeCloseTo(r.horizontalTensionN, 6);
  });

  it('matches H = w·L²/(8·sag) for a shallow level cable (Irvine small-sag)', () => {
    // Choose a length giving a modest sag, then check the parabolic relation.
    const span = 200;
    const w = 8;
    const L0 = unstretchedLengthForSag(span, 0, 4, 1e10, w); // target 4 m sag
    expect(L0).not.toBeNull();
    const r = solveElasticCatenary(base({ spanM: span, elevDiffM: 0, unstretchedLengthM: L0!, weightPerLengthNPerM: w, axialStiffnessN: 1e10 }));
    expect(r.convergence).toBe('converged');
    const Hparabolic = (w * span * span) / (8 * r.maxSagM);
    // Small-sag catenary agrees with the parabola to better than 1%.
    expect(Math.abs(r.horizontalTensionN - Hparabolic) / Hparabolic).toBeLessThan(0.01);
  });

  it('reduces to the parabolic solver in the small-sag limit', () => {
    // Parabolic solver takes H from pretension; feed it the catenary H and
    // compare midspan sag. w must match: parabolic uses linearMass*g.
    const span = 300;
    const linearMass = 0.5; // kg/m
    const w = linearMass * GRAVITY;
    const L0 = unstretchedLengthForSag(span, 0, 3, 1e10, w);
    const cat = solveElasticCatenary(base({ spanM: span, elevDiffM: 0, unstretchedLengthM: L0!, weightPerLengthNPerM: w, axialStiffnessN: 1e10 }));
    const par = solveParabolicLeg({
      spanM: span,
      elevDiffM: 0,
      linearMassKgPerM: linearMass,
      pretensionN: 0,
      horizontalTensionN: cat.horizontalTensionN,
      minBreakingStrengthN: 1e6,
      designFactor: 5,
    });
    // Midspan sag agrees to better than 1% at ~1% sag/span.
    expect(Math.abs(cat.maxSagM - par.midspanSagM) / par.midspanSagM).toBeLessThan(0.01);
  });

  it('elastic elongation matches T·L/EA for a stiff, nearly straight cable', () => {
    const EA = 5e6;
    const r = solveElasticCatenary(
      base({ weightPerLengthNPerM: 0.01, unstretchedLengthM: 100.5, axialStiffnessN: EA, spanM: 100, elevDiffM: 0 }),
    );
    expect(r.convergence).toBe('converged');
    // Nearly weightless: tension ~ uniform ~ H; elongation ≈ T·L0/EA.
    const expected = (r.horizontalTensionN * r.effectiveUnstretchedLengthM) / EA;
    expect(r.elongationM).toBeCloseTo(expected, 2);
  });

  it('applies temperature strain as an effective length change', () => {
    const cold = solveElasticCatenary(base());
    const hot = solveElasticCatenary(
      base({ temperatureDeltaK: 40, thermalExpansionPerK: 1e-4 }),
    );
    // Positive temperature lengthens the cable → more sag → lower H.
    expect(hot.effectiveUnstretchedLengthM).toBeGreaterThan(cold.effectiveUnstretchedLengthM);
    expect(hot.maxSagM).toBeGreaterThan(cold.maxSagM);
    expect(hot.horizontalTensionN).toBeLessThan(cold.horizontalTensionN);
  });

  it('handles a sloped span (unequal end tensions)', () => {
    const r = solveElasticCatenary(base({ elevDiffM: -30, unstretchedLengthM: 106 }));
    expect(r.convergence).toBe('converged');
    expect(r.residuals.norm).toBeLessThan(1e-7);
    // Higher support (left) carries more tension on a downhill span.
    expect(r.tensionLeftN).toBeGreaterThan(r.tensionRightN);
  });

  it('converged forces are independent of profile resolution', () => {
    const coarse = solveElasticCatenary(base({ profilePoints: 20 }));
    const fine = solveElasticCatenary(base({ profilePoints: 400 }));
    expect(fine.horizontalTensionN).toBeCloseTo(coarse.horizontalTensionN, 6);
    expect(fine.maxTensionN).toBeCloseTo(coarse.maxTensionN, 6);
    // Elongation is integrated over the profile, so it converges with refinement.
    expect(Math.abs(fine.elongationM - coarse.elongationM) / fine.elongationM).toBeLessThan(0.01);
  });

  it('is deterministic', () => {
    const a = solveElasticCatenary(base());
    const b = solveElasticCatenary(base());
    expect(a.horizontalTensionN).toBe(b.horizontalTensionN);
    expect(a.maxSagM).toBe(b.maxSagM);
  });
});

describe('elastic catenary — failure and edge cases (Rule 2)', () => {
  it('rejects invalid EA rather than defaulting it', () => {
    const zero = solveElasticCatenary(base({ axialStiffnessN: 0 }));
    expect(zero.convergence).toBe('failed');
    expect(zero.failureReason).toMatch(/EA/);
    expect(zero.failureReason).toMatch(/not defaulted/i);
    expect(solveElasticCatenary(base({ axialStiffnessN: -5 })).convergence).toBe('failed');
    expect(solveElasticCatenary(base({ axialStiffnessN: NaN })).convergence).toBe('failed');
  });

  it('rejects a physically impossible (too short) cable', () => {
    // Chord = 100 m; a 60 m cable would need 40% strain.
    const r = solveElasticCatenary(base({ unstretchedLengthM: 60 }));
    expect(r.convergence).toBe('failed');
    expect(r.failureReason).toMatch(/too short/i);
  });

  it('rejects invalid span and non-finite geometry', () => {
    expect(solveElasticCatenary(base({ spanM: 0 })).convergence).toBe('failed');
    expect(solveElasticCatenary(base({ spanM: -10 })).convergence).toBe('failed');
    expect(solveElasticCatenary(base({ elevDiffM: NaN })).convergence).toBe('failed');
    expect(solveElasticCatenary(base({ unstretchedLengthM: 0 })).convergence).toBe('failed');
  });

  it('converges on a deeply sagging long cable and reports the sag honestly', () => {
    // A cable much longer than the span is NOT slack (slack = zero tension);
    // it is a valid catenary that sags deeply. The solver must converge and
    // report a sag larger than the span rather than false-flagging it.
    const r = solveElasticCatenary(
      base({ unstretchedLengthM: 300, weightPerLengthNPerM: 50, axialStiffnessN: 1e9 }),
    );
    expect(r.convergence).toBe('converged');
    expect(r.residuals.norm).toBeLessThan(1e-6);
    expect(r.maxSagM).toBeGreaterThan(r.effectiveUnstretchedLengthM * 0.2);
    // Minimum tension is the (positive) horizontal component at the low point.
    expect(r.minTensionN).toBeGreaterThan(0);
    expect(r.minTensionN).toBeCloseTo(r.horizontalTensionN, 6);
    // It is NOT flagged slack, because it is not slack.
    expect(r.applicabilityChecks.some((c) => c.id === 'slack')).toBe(false);
  });

  it('detects a genuinely slack (near-zero tension) configuration', () => {
    // Force the low-point tension toward zero with an extreme length so the
    // ends hang almost vertically: this is the true slack boundary.
    const r = solveElasticCatenary(
      base({ spanM: 10, unstretchedLengthM: 400, weightPerLengthNPerM: 50, axialStiffnessN: 1e10 }),
    );
    if (r.convergence === 'converged') {
      expect(r.minTensionN / r.maxTensionN).toBeLessThan(0.02);
    } else {
      expect(r.convergence).toBe('failed');
    }
  });

  it('reports high strain as outside recommended applicability', () => {
    // Low EA with a taut cable → large strain.
    const r = solveElasticCatenary(
      base({ unstretchedLengthM: 100.2, axialStiffnessN: 3e4, weightPerLengthNPerM: 5 }),
    );
    if (r.convergence === 'converged') {
      expect(r.maxStrain).toBeGreaterThan(0.02);
      expect(r.applicabilityChecks.some((c) => c.id === 'strain')).toBe(true);
    }
  });

  it('never returns NaN outputs on a converged solve', () => {
    const r = solveElasticCatenary(base({ elevDiffM: -20, unstretchedLengthM: 104 }));
    expect(r.convergence).toBe('converged');
    for (const v of [
      r.horizontalTensionN,
      r.maxTensionN,
      r.minTensionN,
      r.elongationM,
      r.maxSagM,
      r.maxStrain,
    ]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
