/**
 * Elastic catenary cable solver — Milestone 8. **Fidelity Level 2.**
 *
 * Solves the exact elastic-catenary equations for a cable of known unstretched
 * length and axial stiffness EA hanging between two supports, iterating on the
 * end-force components until both geometric compatibility equations close.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * FORMULATION (Irvine, "Cable Structures", 1981, §2.3)
 * ═══════════════════════════════════════════════════════════════════════
 * Unknowns: H (horizontal force, constant along the cable) and V (vertical
 * force at the LEFT support, positive up on the cable).
 *
 * With unstretched length L0, weight per unit UNSTRETCHED length w, and axial
 * stiffness EA, the coordinates of the right support relative to the left are
 * obtained by integrating along the unstretched arc coordinate s ∈ [0, L0]:
 *
 *   x(L0) = (H·L0)/EA + (H/w)·[ asinh(V/H) − asinh((V − w·L0)/H) ]      (1)
 *   z(L0) = (V·L0)/EA − (w·L0²)/(2·EA)
 *           + (1/w)·[ sqrt(H² + V²) − sqrt(H² + (V − w·L0)²) ]          (2)
 *
 * The first term of each is the elastic stretch contribution; the remainder is
 * the classical (inextensible) catenary. Residuals are
 *   r₁ = x(L0) − Δx,   r₂ = z(L0) − Δz
 * and are driven to zero by Newton's method with an analytic Jacobian.
 *
 * Tension at unstretched coordinate s:
 *   T(s) = sqrt( H² + (V − w·s)² )                                       (3)
 * Axial strain:  ε(s) = T(s)/EA                                          (4)
 *
 * Sign convention: z is positive UP. The left support is the origin. For the
 * CUFTS main line the left support is the master node and Δz is negative.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ASSUMPTIONS AND LIMITS (Rule 6 — reported with every result)
 * ═══════════════════════════════════════════════════════════════════════
 * C1. Perfectly flexible cable: no bending stiffness.
 * C2. Linear-elastic axial behaviour, constant EA. No material nonlinearity,
 *     no plasticity.
 * C3. Self-weight is uniform per unit UNSTRETCHED length.
 * C4. Static equilibrium in a vertical plane; no out-of-plane load (that is
 *     the Milestone 11 lumped-mass model).
 * C5. Temperature strain and creep are applied as an effective change in
 *     unstretched length, not as a coupled thermo-mechanical solve.
 * C6. Tension-only: a solution whose minimum tension approaches zero is
 *     reported as slack rather than being silently accepted.
 */

import type { ApplicabilityCheck, ConvergenceStatus } from '../core/solver';

export interface ElasticCatenaryInput {
  /** Horizontal distance from left to right support, m (> 0). */
  spanM: number;
  /** Elevation of right support minus left support, m (signed, + up). */
  elevDiffM: number;
  /** Unstretched cable length, m (> 0). */
  unstretchedLengthM: number;
  /** Axial stiffness EA, N (> 0). */
  axialStiffnessN: number;
  /** Weight per unit unstretched length, N/m (≥ 0). */
  weightPerLengthNPerM: number;
  /** Temperature change from the reference state, K (optional). */
  temperatureDeltaK?: number;
  /** Coefficient of thermal expansion, 1/K (optional). */
  thermalExpansionPerK?: number;
  /** Constructional stretch / creep allowance as a strain (optional). */
  creepStrain?: number;
  /** Convergence tolerance on the geometric residuals, m. */
  toleranceM?: number;
  maxIterations?: number;
  /** Number of profile sample points returned. */
  profilePoints?: number;
  /** Optional initial guess for [H, V], N. */
  initialGuess?: { H: number; V: number };
}

export interface CatenaryProfilePoint {
  /** Unstretched arc coordinate, m. */
  s: number;
  /** Horizontal position from the left support, m. */
  x: number;
  /** Elevation relative to the left support, m. */
  z: number;
  /** Tension at this station, N. */
  tensionN: number;
  /** Axial strain, dimensionless. */
  strain: number;
}

export interface ElasticCatenaryResult {
  convergence: ConvergenceStatus;
  iterations: number;
  /** Final residuals: geometric closure in x and z, m. */
  residuals: { x: number; z: number; norm: number };
  /** Horizontal force component, N (constant along the cable). */
  horizontalTensionN: number;
  /** Vertical force at the left support, N (+ up on the cable). */
  verticalForceLeftN: number;
  /** Vertical force at the right support, N (+ up on the cable). */
  verticalForceRightN: number;
  tensionLeftN: number;
  tensionRightN: number;
  maxTensionN: number;
  minTensionN: number;
  /** Stretched (deformed) arc length, m. */
  stretchedLengthM: number;
  /** Total elastic elongation, m. */
  elongationM: number;
  /** Effective unstretched length after temperature and creep, m. */
  effectiveUnstretchedLengthM: number;
  /** Maximum sag below the straight chord, m. */
  maxSagM: number;
  /** Lowest point of the cable relative to the left support, m. */
  lowestPointZM: number;
  /** Horizontal position of the lowest point, m. */
  lowestPointXM: number;
  maxStrain: number;
  profile: CatenaryProfilePoint[];
  assumptions: string[];
  applicabilityChecks: ApplicabilityCheck[];
  warnings: string[];
  /** Set when the solve failed; the result must not be used. */
  failureReason?: string;
}

const DEFAULT_TOL = 1e-9;
const DEFAULT_MAX_ITER = 200;

/** Geometric closure functions (1) and (2). */
function geometry(
  H: number,
  V: number,
  L0: number,
  w: number,
  EA: number,
): { x: number; z: number } {
  if (w === 0) {
    // Straight elastic bar: uniform tension T = sqrt(H²+V²).
    const T = Math.hypot(H, V);
    const stretch = 1 + T / EA;
    return { x: (H / T) * L0 * stretch, z: (V / T) * L0 * stretch };
  }
  const a = V / H;
  const b = (V - w * L0) / H;
  const x = (H * L0) / EA + (H / w) * (Math.asinh(a) - Math.asinh(b));
  const z =
    (V * L0) / EA -
    (w * L0 * L0) / (2 * EA) +
    (1 / w) * (Math.hypot(H, V) - Math.hypot(H, V - w * L0));
  return { x, z };
}

/** Analytic Jacobian of (x, z) with respect to (H, V). */
function jacobian(
  H: number,
  V: number,
  L0: number,
  w: number,
  EA: number,
): [[number, number], [number, number]] {
  if (w === 0) {
    const T = Math.hypot(H, V);
    // d/dH and d/dV of ((H or V)/T)*L0*(1+T/EA)
    const dxdH = (L0 * (V * V)) / (T * T * T) + (L0 * H * H) / (EA * T * T) + (L0 * V * V) / (EA * T * T);
    const dxdV = (-L0 * H * V) / (T * T * T);
    const dzdH = (-L0 * H * V) / (T * T * T);
    const dzdV = (L0 * (H * H)) / (T * T * T) + (L0 * V * V) / (EA * T * T) + (L0 * H * H) / (EA * T * T);
    return [
      [dxdH, dxdV],
      [dzdH, dzdV],
    ];
  }
  const a = V / H;
  const b = (V - w * L0) / H;
  const Ta = Math.hypot(H, V);
  const Tb = Math.hypot(H, V - w * L0);

  // d(asinh(u))/du = 1/sqrt(1+u²); u = V/H → du/dH = −V/H², du/dV = 1/H
  const sa = 1 / Math.sqrt(1 + a * a);
  const sb = 1 / Math.sqrt(1 + b * b);

  const dxdH =
    L0 / EA +
    (1 / w) * (Math.asinh(a) - Math.asinh(b)) +
    (H / w) * (sa * (-V / (H * H)) - sb * (-(V - w * L0) / (H * H)));
  const dxdV = (H / w) * (sa * (1 / H) - sb * (1 / H));

  const dzdH = (1 / w) * (H / Ta - H / Tb);
  const dzdV = L0 / EA + (1 / w) * (V / Ta - (V - w * L0) / Tb);

  return [
    [dxdH, dxdV],
    [dzdH, dzdV],
  ];
}

/**
 * Solves the elastic catenary. Never throws for physically meaningful but
 * infeasible input — it returns a failed result with a reason, so callers
 * report rather than crash (Rule 2).
 */
export function solveElasticCatenary(input: ElasticCatenaryInput): ElasticCatenaryResult {
  const tol = input.toleranceM ?? DEFAULT_TOL;
  const maxIter = input.maxIterations ?? DEFAULT_MAX_ITER;
  const nPts = input.profilePoints ?? 50;

  const assumptions = [
    'C1: Perfectly flexible cable; no bending stiffness.',
    'C2: Linear-elastic axial behaviour with constant EA.',
    'C3: Self-weight uniform per unit unstretched length.',
    'C4: Static planar equilibrium; out-of-plane load not modeled.',
    'C5: Temperature and creep applied as an effective unstretched-length change.',
    'C6: Tension-only; a near-zero minimum tension is reported as slack.',
  ];
  const warnings: string[] = [];
  const checks: ApplicabilityCheck[] = [];

  const fail = (reason: string): ElasticCatenaryResult => ({
    convergence: 'failed',
    iterations: 0,
    residuals: { x: NaN, z: NaN, norm: NaN },
    horizontalTensionN: NaN,
    verticalForceLeftN: NaN,
    verticalForceRightN: NaN,
    tensionLeftN: NaN,
    tensionRightN: NaN,
    maxTensionN: NaN,
    minTensionN: NaN,
    stretchedLengthM: NaN,
    elongationM: NaN,
    effectiveUnstretchedLengthM: NaN,
    maxSagM: NaN,
    lowestPointZM: NaN,
    lowestPointXM: NaN,
    maxStrain: NaN,
    profile: [],
    assumptions,
    applicabilityChecks: [
      { id: 'input', label: 'Input validity', status: 'invalidInput', detail: reason },
    ],
    warnings: [reason],
    failureReason: reason,
  });

  // ── input validation (Rule 2: invalid input is never a result) ──
  const { spanM, elevDiffM, axialStiffnessN: EA0, weightPerLengthNPerM: w } = input;
  if (!Number.isFinite(spanM) || spanM <= 0) return fail('Span must be a positive, finite number.');
  if (!Number.isFinite(elevDiffM)) return fail('Elevation difference must be finite.');
  if (!Number.isFinite(EA0) || EA0 <= 0) {
    return fail('Axial stiffness EA must be a positive, finite number. It is not defaulted.');
  }
  if (!Number.isFinite(w) || w < 0) return fail('Weight per unit length must be finite and ≥ 0.');
  if (!Number.isFinite(input.unstretchedLengthM) || input.unstretchedLengthM <= 0) {
    return fail('Unstretched length must be a positive, finite number.');
  }

  // ── effective unstretched length: temperature + creep (C5) ──
  const thermalStrain =
    (input.temperatureDeltaK ?? 0) * (input.thermalExpansionPerK ?? 0);
  const creep = input.creepStrain ?? 0;
  const L0 = input.unstretchedLengthM * (1 + thermalStrain + creep);
  if (!(L0 > 0)) return fail('Effective unstretched length is not positive after temperature/creep.');

  const chord = Math.hypot(spanM, elevDiffM);
  if (L0 <= chord) {
    // A cable shorter than the straight chord cannot reach: it would have to
    // stretch elastically. That is only possible if EA permits it, so report
    // it as a distinct, explicit condition rather than iterating to nonsense.
    const requiredStrain = (chord - L0) / L0;
    const requiredTension = requiredStrain * EA0;
    if (requiredStrain > 0.1) {
      return fail(
        `Cable is physically too short: unstretched length ${L0.toFixed(3)} m versus chord ` +
          `${chord.toFixed(3)} m requires ${(requiredStrain * 100).toFixed(1)}% strain ` +
          `(${(requiredTension / 1000).toFixed(0)} kN). Increase the length or the span is infeasible.`,
      );
    }
    warnings.push(
      `Cable is shorter than the chord; it carries no sag and is taut at approximately ` +
        `${(requiredStrain * 100).toFixed(3)}% strain. Verify EA and pretension.`,
    );
  }

  // ── initial guess ──
  // Taut-string estimate: H ≈ w·L²/(8·sag) with a small assumed sag, or the
  // elastic bar solution when weightless.
  let H: number;
  let V: number;
  if (input.initialGuess) {
    H = input.initialGuess.H;
    V = input.initialGuess.V;
  } else if (w === 0) {
    const T = Math.max(EA0 * Math.max((chord - L0) / L0, 1e-6), 1);
    H = (T * spanM) / chord;
    V = (T * elevDiffM) / chord;
  } else {
    const assumedSag = Math.max(0.02 * spanM, 1e-3);
    H = Math.max((w * spanM * spanM) / (8 * assumedSag), 1);
    V = (w * L0) / 2 + (H * elevDiffM) / spanM;
  }

  // ── Newton iteration with damping ──
  let iterations = 0;
  let rx = NaN;
  let rz = NaN;
  let convergence: ConvergenceStatus = 'notConverged';

  for (iterations = 1; iterations <= maxIter; iterations++) {
    const g = geometry(H, V, L0, w, EA0);
    rx = g.x - spanM;
    rz = g.z - elevDiffM;
    if (!Number.isFinite(rx) || !Number.isFinite(rz)) {
      return fail('Solver produced a non-finite residual; check EA, length, and geometry.');
    }
    if (Math.hypot(rx, rz) < tol) {
      convergence = 'converged';
      break;
    }
    const J = jacobian(H, V, L0, w, EA0);
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (!Number.isFinite(det) || Math.abs(det) < 1e-30) {
      return fail('Jacobian is singular; the configuration is degenerate (check span and length).');
    }
    // Solve J·[dH, dV] = −[rx, rz]
    const dH = (-rx * J[1][1] + rz * J[0][1]) / det;
    const dV = (-rz * J[0][0] + rx * J[1][0]) / det;

    // Damp so H stays positive (a non-positive H is not a cable state).
    let step = 1;
    while (step > 1e-6 && H + step * dH <= 0) step /= 2;
    H += step * dH;
    V += step * dV;

    if (!Number.isFinite(H) || !Number.isFinite(V)) {
      return fail('Solver diverged to a non-finite state; try a different initial guess.');
    }
  }

  if (convergence !== 'converged') {
    iterations = maxIter;
    warnings.push(
      `Newton iteration did not reach the ${tol} m tolerance in ${maxIter} iterations ` +
        `(residual ${Math.hypot(rx, rz).toExponential(2)} m). The result must not be used.`,
    );
    checks.push({
      id: 'convergence',
      label: 'Convergence',
      status: 'didNotConverge',
      measured: Math.hypot(rx, rz),
      limit: tol,
      detail: 'Geometric closure residual exceeds the tolerance.',
    });
  }

  // ── derived results ──
  const Vright = w * L0 - V; // vertical force at the right support, + up on cable
  const tensionLeft = Math.hypot(H, V);
  const tensionRight = Math.hypot(H, Vright);
  const maxTension = Math.max(tensionLeft, tensionRight);
  // Minimum tension is H when the low point lies inside the span, else an end.
  const lowPointInside = V > 0 && V < w * L0;
  const minTension = w === 0 ? tensionLeft : lowPointInside ? H : Math.min(tensionLeft, tensionRight);

  // Profile
  const profile: CatenaryProfilePoint[] = [];
  let lowestZ = Infinity;
  let lowestX = 0;
  for (let i = 0; i <= nPts; i++) {
    const s = (i / nPts) * L0;
    const g = geometry(H, V, s, w, EA0);
    const T = Math.hypot(H, V - w * s);
    profile.push({ s, x: g.x, z: g.z, tensionN: T, strain: T / EA0 });
    if (g.z < lowestZ) {
      lowestZ = g.z;
      lowestX = g.x;
    }
  }

  // Stretched length: ∫(1 + T/EA) ds, trapezoid over the profile.
  let stretched = 0;
  for (let i = 1; i < profile.length; i++) {
    const ds = profile[i].s - profile[i - 1].s;
    stretched += 0.5 * (2 + profile[i].strain + profile[i - 1].strain) * ds;
  }
  const elongation = stretched - L0;

  // Max sag below the straight chord.
  let maxSag = 0;
  for (const p of profile) {
    const chordZ = (p.x / spanM) * elevDiffM;
    maxSag = Math.max(maxSag, chordZ - p.z);
  }

  const maxStrain = Math.max(...profile.map((p) => p.strain));

  // ── applicability checks (Rule 6) ──
  if (convergence === 'converged') {
    checks.push({
      id: 'convergence',
      label: 'Convergence',
      status: 'validWithinLimits',
      measured: Math.hypot(rx, rz),
      limit: tol,
      detail: 'Geometric closure achieved within tolerance.',
    });
  }
  if (minTension < 1e-6 * Math.max(maxTension, 1)) {
    checks.push({
      id: 'slack',
      label: 'Cable slack',
      status: 'physicallyInfeasible',
      measured: minTension,
      detail: 'Minimum tension is essentially zero: the cable is slack and this model does not apply.',
    });
    warnings.push('SLACK CABLE: minimum tension is essentially zero; the tension-only model is invalid here.');
  }
  if (maxStrain > 0.02) {
    checks.push({
      id: 'strain',
      label: 'Axial strain',
      status: maxStrain > 0.05 ? 'outsideRecommended' : 'validWithCaution',
      measured: maxStrain,
      limit: 0.02,
      detail: 'High axial strain; confirm the linear-elastic EA assumption is still valid.',
    });
    warnings.push(
      `Peak axial strain ${(maxStrain * 100).toFixed(2)}% exceeds 2%; the constant-EA ` +
        'assumption (C2) may no longer hold.',
    );
  }
  const slopeDeg = (Math.atan2(Math.abs(elevDiffM), spanM) * 180) / Math.PI;
  if (slopeDeg > 60) {
    checks.push({
      id: 'steep',
      label: 'Chord slope',
      status: 'validWithCaution',
      measured: slopeDeg,
      limit: 60,
      detail: 'Near-vertical geometry; convergence is sensitive to the initial guess.',
    });
  }

  return {
    convergence,
    iterations,
    residuals: { x: rx, z: rz, norm: Math.hypot(rx, rz) },
    horizontalTensionN: H,
    verticalForceLeftN: V,
    verticalForceRightN: Vright,
    tensionLeftN: tensionLeft,
    tensionRightN: tensionRight,
    maxTensionN: maxTension,
    minTensionN: minTension,
    stretchedLengthM: stretched,
    elongationM: elongation,
    effectiveUnstretchedLengthM: L0,
    maxSagM: maxSag,
    lowestPointZM: lowestZ,
    lowestPointXM: lowestX,
    maxStrain,
    profile,
    assumptions,
    applicabilityChecks: checks,
    warnings,
  };
}

/**
 * Convenience: finds the unstretched length that produces a target midspan sag
 * for level supports, by bisection. Useful for setting up a scenario from a
 * desired sag rather than a length.
 */
export function unstretchedLengthForSag(
  spanM: number,
  elevDiffM: number,
  targetSagM: number,
  EA: number,
  w: number,
): number | null {
  if (!(targetSagM > 0) || !(spanM > 0)) return null;
  const chord = Math.hypot(spanM, elevDiffM);
  let lo = chord * (1 + 1e-9);
  let hi = chord * 3;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    const r = solveElasticCatenary({
      spanM,
      elevDiffM,
      unstretchedLengthM: mid,
      axialStiffnessN: EA,
      weightPerLengthNPerM: w,
      profilePoints: 40,
    });
    if (r.convergence !== 'converged') return null;
    if (r.maxSagM > targetSagM) hi = mid;
    else lo = mid;
    if (Math.abs(r.maxSagM - targetSagM) < 1e-6) return mid;
  }
  return 0.5 * (lo + hi);
}
