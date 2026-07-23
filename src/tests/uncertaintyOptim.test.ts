/**
 * Milestone 12 — uncertainty/sensitivity and constrained optimization.
 *
 * Optimizer benchmarks use functions with known optima; sensitivity uses
 * linear/monotone responses where the tornado order and worst case are known
 * by hand. The governance focus: an infeasible problem is never returned as a
 * valid design, and a non-finite (failed) objective is never chosen.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeSensitivity,
  parameterSweep,
  probabilityOfExceedance,
  type UncertainParameter,
} from '../calculations/sensitivity';
import { optimize, type ConstraintDef, type DesignVariable } from '../calculations/optimization';

const P: UncertainParameter[] = [
  { key: 'a', label: 'A', low: 0, nominal: 1, high: 2 },
  { key: 'b', label: 'B', low: 0, nominal: 5, high: 10 },
];

describe('sensitivity analysis', () => {
  it('orders the tornado by response swing', () => {
    // R = a + 3·b. Swing_a = (2−0)/2 = 1; Swing_b = 3·(10−0)/2 = 15. b dominates.
    const r = analyzeSensitivity(P, (v) => v.a + 3 * v.b);
    expect(r.nominalResponse).toBe(1 + 15);
    expect(r.tornado[0].key).toBe('b');
    expect(r.tornado[0].swing).toBeCloseTo(15, 9);
    expect(r.tornado[1].swing).toBeCloseTo(1, 9);
    expect(r.tornado.every((e) => e.direction === 1)).toBe(true);
  });

  it('computes worst- and best-case combinations for a monotone response', () => {
    const r = analyzeSensitivity(P, (v) => v.a + 3 * v.b);
    // Max: a=2, b=10 → 32. Min: a=0, b=0 → 0.
    expect(r.worstCaseMaxResponse).toBeCloseTo(32, 9);
    expect(r.bestCaseMinResponse).toBeCloseTo(0, 9);
    expect(r.worstCaseMaxValues).toEqual({ a: 2, b: 10 });
  });

  it('handles a response that decreases with a parameter', () => {
    // R = 10 − b: increasing b lowers R, so worst case (max R) uses b=low.
    const r = analyzeSensitivity(P, (v) => 10 - v.b);
    const bEntry = r.tornado.find((e) => e.key === 'b')!;
    expect(bEntry.direction).toBe(-1);
    expect(r.worstCaseMaxValues.b).toBe(0);
  });

  it('sweeps a parameter across its range', () => {
    const sweep = parameterSweep(P, 'b', (v) => 2 * v.b, 6);
    expect(sweep).toHaveLength(6);
    expect(sweep[0]).toEqual({ value: 0, response: 0 });
    expect(sweep[5].value).toBeCloseTo(10, 9);
    expect(sweep[5].response).toBeCloseTo(20, 9);
  });

  it('estimates probability of limit exceedance with the distribution attached', () => {
    // R = b, 3-point {0:.25, 5:.5, 10:.25} for b (a has no effect). P(R>7)=P(b=10)=0.25.
    const r = probabilityOfExceedance(P, (v) => v.b, 7);
    expect(r.probabilityExceed).toBeCloseTo(0.25, 9);
    expect(r.combinationsEvaluated).toBe(9); // 3^2
    expect(r.distribution.length).toBe(9); // full grid returned (never hidden)
  });
});

describe('constrained optimization — analytical optima', () => {
  const vars: DesignVariable[] = [{ key: 'x', label: 'X', min: -5, max: 5 }];

  it('finds the minimum of a convex 1-D objective', () => {
    // min (x−2)² over [−5,5] → x=2.
    const r = optimize({ variables: vars, objective: (v) => (v.x - 2) ** 2 });
    expect(r.success).toBe(true);
    expect(r.feasible).toBe(true);
    expect(r.bestVariables.x).toBeCloseTo(2, 4);
    expect(r.bestObjective).toBeCloseTo(0, 6);
  });

  it('finds a 2-D minimum (separable quadratic)', () => {
    const r = optimize({
      variables: [
        { key: 'x', label: 'X', min: -10, max: 10 },
        { key: 'y', label: 'Y', min: -10, max: 10 },
      ],
      objective: (v) => (v.x - 3) ** 2 + (v.y + 4) ** 2,
    });
    expect(r.bestVariables.x).toBeCloseTo(3, 3);
    expect(r.bestVariables.y).toBeCloseTo(-4, 3);
  });

  it('respects an active inequality constraint', () => {
    // min (x−2)² subject to x ≤ 1 → optimum at the bound x=1.
    const constraints: ConstraintDef[] = [
      { key: 'c1', label: 'x ≤ 1', evaluate: (v) => v.x - 1 },
    ];
    const r = optimize({ variables: vars, objective: (v) => (v.x - 2) ** 2, constraints });
    expect(r.feasible).toBe(true);
    expect(r.bestVariables.x).toBeCloseTo(1, 3);
    expect(r.constraints[0].satisfied).toBe(true);
  });

  it('reports infeasibility instead of returning a valid-looking design', () => {
    // Constraints x ≤ −3 AND x ≥ 3 cannot both hold on [−5,5].
    const constraints: ConstraintDef[] = [
      { key: 'lo', label: 'x ≤ −3', evaluate: (v) => v.x - -3 },
      { key: 'hi', label: 'x ≥ 3', evaluate: (v) => 3 - v.x },
    ];
    const r = optimize({ variables: vars, objective: (v) => v.x * v.x, constraints });
    expect(r.feasible).toBe(false);
    expect(r.success).toBe(false);
    expect(r.controllingConstraints.length).toBeGreaterThan(0);
    expect(r.warnings.join(' ')).toMatch(/INFEASIBLE/i);
  });

  it('never selects a point where the objective is non-finite (failed solve)', () => {
    // Objective returns NaN for x<0 (simulating invalid geometry / solver fail).
    const r = optimize({
      variables: [{ key: 'x', label: 'X', min: -5, max: 5, start: 4 }],
      objective: (v) => (v.x < 0 ? NaN : (v.x - 1) ** 2),
    });
    expect(r.bestVariables.x).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.bestObjective)).toBe(true);
    expect(r.bestVariables.x).toBeCloseTo(1, 3);
  });

  it('returns search history and local sensitivity', () => {
    const r = optimize({ variables: vars, objective: (v) => (v.x - 2) ** 2 });
    expect(r.history.length).toBeGreaterThan(1);
    expect(r.sensitivity[0].key).toBe('x');
    // Near the minimum the gradient is ~0.
    expect(Math.abs(r.sensitivity[0].gradient)).toBeLessThan(1e-2);
  });

  it('rejects degenerate variable ranges', () => {
    const r = optimize({ variables: [{ key: 'x', label: 'X', min: 5, max: 5 }], objective: (v) => v.x });
    expect(r.failureReason).toBeTruthy();
  });

  it('is deterministic', () => {
    const mk = () => optimize({ variables: vars, objective: (v) => (v.x - 2) ** 2 });
    expect(mk().bestVariables.x).toBe(mk().bestVariables.x);
  });
});
