/**
 * Bounded constrained optimization — Milestone 12.
 *
 * Minimizes a scalar objective over one or more bounded design variables,
 * subject to inequality constraints g(x) ≤ 0. Uses a deterministic
 * coordinate-descent + golden-section line search (gradient-free, robust for
 * the low-dimensional, possibly non-smooth engineering objectives here).
 *
 * Governance (optimization rules):
 *  - The optimizer NEVER returns an apparently valid design when the problem is
 *    infeasible: `feasible` is an explicit flag and an infeasible result is
 *    reported as such, with the controlling (most-violated) constraint.
 *  - Invalid geometry / solver failure is signaled by the objective returning
 *    a non-finite value; such points are rejected, never treated as optimal.
 *  - The controlling constraints, the full search history, and local
 *    sensitivity around the chosen point are all returned (nothing hidden).
 */

export interface DesignVariable {
  key: string;
  label: string;
  min: number;
  max: number;
  /** Starting value; defaults to the midpoint. */
  start?: number;
}

export interface ConstraintDef {
  key: string;
  label: string;
  /** g(x) ≤ 0 is satisfied. The returned value is the (signed) margin. */
  evaluate: (x: Record<string, number>) => number;
}

/** Objective to MINIMIZE. Return a non-finite value for an infeasible/failed point. */
export type ObjectiveFn = (x: Record<string, number>) => number;

export interface OptimizationInput {
  variables: DesignVariable[];
  objective: ObjectiveFn;
  constraints?: ConstraintDef[];
  /** Penalty weight applied to constraint violations during the search. */
  penaltyWeight?: number;
  maxIterations?: number;
  toleranceX?: number;
  /**
   * Absolute tolerance on constraint satisfaction, g ≤ feasTol. A penalty
   * method converges to an active constraint from the infeasible side by a
   * vanishing amount, so a small tolerance is standard; it is reported.
   */
  feasibilityTolerance?: number;
}

export interface ConstraintReport {
  key: string;
  label: string;
  value: number;
  satisfied: boolean;
}

export interface SensitivityAtOptimum {
  key: string;
  label: string;
  /** Objective change per unit variable change near the optimum (finite diff). */
  gradient: number;
}

export interface OptimizationResult {
  feasible: boolean;
  /** True only when a feasible point was found AND the objective is finite there. */
  success: boolean;
  bestVariables: Record<string, number>;
  bestObjective: number;
  constraints: ConstraintReport[];
  /** Constraints that are violated, worst first. Empty when feasible. */
  controllingConstraints: ConstraintReport[];
  iterations: number;
  /** Every accepted step: variables, objective, penalized objective. */
  history: { variables: Record<string, number>; objective: number; penalized: number }[];
  sensitivity: SensitivityAtOptimum[];
  warnings: string[];
  failureReason?: string;
}

const GOLDEN = (Math.sqrt(5) - 1) / 2; // 0.618...

export function optimize(input: OptimizationInput): OptimizationResult {
  const vars = input.variables;
  const constraints = input.constraints ?? [];
  const penaltyWeight = input.penaltyWeight ?? 1e8;
  const maxIter = input.maxIterations ?? 60;
  const tolX = input.toleranceX ?? 1e-6;
  const feasTol = input.feasibilityTolerance ?? 1e-6;
  const warnings: string[] = [];

  const fail = (reason: string): OptimizationResult => ({
    feasible: false,
    success: false,
    bestVariables: {},
    bestObjective: NaN,
    constraints: [],
    controllingConstraints: [],
    iterations: 0,
    history: [],
    sensitivity: [],
    warnings: [reason],
    failureReason: reason,
  });

  if (vars.length === 0) return fail('No design variables supplied.');
  for (const v of vars) {
    if (!(v.min < v.max)) return fail(`Variable "${v.key}" has an empty range [${v.min}, ${v.max}].`);
  }

  // Penalized objective: objective + penalty·Σ max(0, g_i)². Non-finite
  // objective → +Infinity so the point is never selected (invalid geometry /
  // solver failure).
  const evalConstraints = (x: Record<string, number>): ConstraintReport[] =>
    constraints.map((c) => {
      const value = c.evaluate(x);
      return { key: c.key, label: c.label, value, satisfied: Number.isFinite(value) && value <= feasTol };
    });

  const penalized = (x: Record<string, number>): number => {
    const obj = input.objective(x);
    if (!Number.isFinite(obj)) return Number.POSITIVE_INFINITY;
    let pen = 0;
    for (const c of constraints) {
      const g = c.evaluate(x);
      if (!Number.isFinite(g)) return Number.POSITIVE_INFINITY;
      if (g > 0) pen += g * g;
    }
    return obj + penaltyWeight * pen;
  };

  const x: Record<string, number> = {};
  for (const v of vars) x[v.key] = v.start ?? 0.5 * (v.min + v.max);

  const history: OptimizationResult['history'] = [];
  const record = (xv: Record<string, number>) => {
    const obj = input.objective(xv);
    history.push({ variables: { ...xv }, objective: obj, penalized: penalized(xv) });
  };
  record(x);

  let iterations = 0;
  let improvedAny = true;
  while (improvedAny && iterations < maxIter) {
    improvedAny = false;
    iterations++;
    for (const v of vars) {
      // Golden-section line search on this coordinate within [min, max].
      let a = v.min;
      let b = v.max;
      const f = (t: number): number => penalized({ ...x, [v.key]: t });
      let c1 = b - GOLDEN * (b - a);
      let c2 = a + GOLDEN * (b - a);
      let f1 = f(c1);
      let f2 = f(c2);
      let guard = 0;
      while (b - a > tolX && guard++ < 200) {
        if (f1 < f2) {
          b = c2;
          c2 = c1;
          f2 = f1;
          c1 = b - GOLDEN * (b - a);
          f1 = f(c1);
        } else {
          a = c1;
          c1 = c2;
          f1 = f2;
          c2 = a + GOLDEN * (b - a);
          f2 = f(c2);
        }
      }
      const best = 0.5 * (a + b);
      const before = penalized(x);
      const after = penalized({ ...x, [v.key]: best });
      if (after < before - 1e-12) {
        x[v.key] = best;
        improvedAny = true;
        record(x);
      }
    }
  }

  const finalConstraints = evalConstraints(x);
  const violated = finalConstraints
    .filter((c) => !c.satisfied)
    .sort((a, b) => b.value - a.value);
  const objAtX = input.objective(x);
  const feasible = violated.length === 0 && Number.isFinite(objAtX);

  // Local sensitivity: central finite difference of the objective per variable.
  const sensitivity: SensitivityAtOptimum[] = vars.map((v) => {
    const h = Math.max(1e-6, 1e-4 * (v.max - v.min));
    const xp = { ...x, [v.key]: Math.min(v.max, x[v.key] + h) };
    const xm = { ...x, [v.key]: Math.max(v.min, x[v.key] - h) };
    const fp = input.objective(xp);
    const fm = input.objective(xm);
    const grad = Number.isFinite(fp) && Number.isFinite(fm) ? (fp - fm) / (2 * h) : NaN;
    return { key: v.key, label: v.label, gradient: grad };
  });

  if (!feasible) {
    warnings.push(
      violated.length > 0
        ? `Problem is INFEASIBLE: ${violated.length} constraint(s) violated. This is not a valid design.`
        : 'Objective is non-finite at the best point (invalid geometry or solver failure).',
    );
  }
  if (iterations >= maxIter) {
    warnings.push(`Reached the iteration limit (${maxIter}); the result may not be fully converged.`);
  }

  return {
    feasible,
    success: feasible,
    bestVariables: { ...x },
    bestObjective: objAtX,
    constraints: finalConstraints,
    controllingConstraints: violated,
    iterations,
    history,
    sensitivity,
    warnings,
  };
}
