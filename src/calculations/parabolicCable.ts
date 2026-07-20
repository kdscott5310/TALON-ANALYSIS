/**
 * Parabolic Cable Solver — Milestone 2
 *
 * Solves for static cable shape, tensions, sag, and reactions using the
 * parabolic approximation for each cable leg independently.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ASSUMPTIONS (parabolic approximation)
 * ═══════════════════════════════════════════════════════════════════════
 * A1. Cable self-weight is uniformly distributed along the HORIZONTAL
 *     projection, not along the cable arc. This is the standard
 *     parabolic simplification.
 * A2. Cable is perfectly flexible (no bending stiffness).
 * A3. Elastic elongation is neglected in this model. (Elastic catenary
 *     is a future milestone.)
 * A4. Wind and temperature effects on geometry are neglected.
 * A5. The parabolic model is appropriate when sag/span < ~0.08 and
 *     cable slope is moderate. Warnings are issued when violated.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EQUATIONS (reference: Irvine, "Cable Structures", 1981)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Coordinate system: origin at the LEFT support (higher end for
 * the main downhill leg; lower end for the backstay). x is horizontal
 * toward the right support, y is positive upward.
 *
 * Given:
 *   L   = horizontal span between supports (m)
 *   h   = elevation difference (right.y − left.y), signed (+up) (m)
 *   w   = distributed load per unit horizontal length (N/m)
 *         = cable linear mass (kg/m) * g
 *   H   = horizontal tension component (N) — constant along cable
 *   P   = optional point load at horizontal position xP (N)
 *
 * ── Self-weight only (no point load) ──
 *
 * Cable shape:
 *   y(x) = (w / (2H)) * x * (L − x) + (h / L) * x      ... (1)
 *
 * where the first term is the parabolic sag (concave downward relative
 * to the chord) and the second term is the linear slope between
 * supports.
 *
 * Sag at midspan relative to the chord:
 *   d = w * L^2 / (8 * H)                                ... (2)
 *
 * Vertical reactions:
 *   V_left  = w * L / 2 − h * H / L                      ... (3a)
 *   V_right = w * L / 2 + h * H / L                      ... (3b)
 *   (Signs: positive = upward at the support.)
 *
 * Resultant tension at endpoints:
 *   T_left  = sqrt(H^2 + V_left^2)                       ... (4a)
 *   T_right = sqrt(H^2 + V_right^2)                      ... (4b)
 *
 * Cable length (parabolic approx):
 *   S ≈ L * (1 + (8/3)(d/L)^2)                           ... (5)
 *
 * ── With a point load P at position xP ──
 *
 * The cable becomes two straight-ish parabolic segments joined at xP.
 * For the parabolic approximation with a concentrated load, we solve
 * equilibrium at the load point.
 *
 * For Milestone 2 the trolley point load is applied to the MAIN leg
 * only, at a user-selected fractional position along the span. The
 * backstay carries only self-weight.
 *
 * Vertical reactions with point load at xP:
 *   V_left  = w * L / 2 − h * H / L + P * (L − xP) / L  ... (6a)
 *   V_right = w * L / 2 + h * H / L + P * xP / L         ... (6b)
 *
 * Cable deflection at the load point (additional to self-weight sag):
 *   δ_P = P * xP * (L − xP) / (H * L)                    ... (7)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HORIZONTAL TENSION FROM PRETENSION
 * ═══════════════════════════════════════════════════════════════════════
 * When the user specifies a pretension (the tension before the trolley
 * load), we infer H from the unloaded cable:
 *
 *   T_max ≈ max(T_left, T_right)  for the unloaded case
 *
 * For the unloaded parabolic cable on a slope, the maximum tension is
 * at the HIGHER support. Given pretension T₀:
 *
 *   H = T₀ / sqrt(1 + (V_left/H)^2)
 *
 * This is implicit in H. We solve iteratively:
 *   H₀ = T₀  (initial guess: small sag → H ≈ T₀)
 *   Iterate: V = wL/2 − hH/L, H_new = T₀ / sqrt(1 + (V/H)^2)
 *   until |H_new − H| < tolerance.
 *
 * For the loaded case, the same H is used (pretension sets the cable,
 * then the trolley is placed on it). This neglects the geometric
 * stiffening effect; the elastic catenary solver (future) will handle
 * that properly.
 */

import { GRAVITY } from '../units/units';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface CableLegInput {
  /** Horizontal span between supports, m (must be > 0) */
  spanM: number;
  /** Elevation of right support minus left support, m (signed) */
  elevDiffM: number;
  /** Cable linear mass, kg/m */
  linearMassKgPerM: number;
  /** Cable pretension (max endpoint tension, unloaded), N.
   *  If 0, horizontalTensionN must be provided instead. */
  pretensionN: number;
  /** Override: supply H directly (N). Used when pretensionN = 0. */
  horizontalTensionN?: number;
  /** Minimum breaking strength, N (for utilization calc) */
  minBreakingStrengthN: number;
  /** Design factor (MBS / allowable) */
  designFactor: number;
}

export interface PointLoadInput {
  /** Point load magnitude, N (positive downward) */
  forceN: number;
  /** Horizontal position of the load measured from the LEFT support, m */
  positionM: number;
}

export interface CableProfilePoint {
  /** Horizontal position from the left support, m */
  x: number;
  /** Elevation above left-support datum, m */
  y: number;
}

export interface CableLegResult {
  /** Horizontal tension component, N */
  horizontalTensionN: number;
  /** Vertical reaction at left support, N (positive = upward) */
  verticalReactionLeftN: number;
  /** Vertical reaction at right support, N (positive = upward) */
  verticalReactionRightN: number;
  /** Resultant tension at left support, N */
  tensionLeftN: number;
  /** Resultant tension at right support, N */
  tensionRightN: number;
  /** Maximum tension anywhere along the cable, N */
  maxTensionN: number;
  /** Midspan sag relative to chord, m (positive = cable below chord) */
  midspanSagM: number;
  /** Minimum elevation of the cable above the left-support datum, m */
  lowestElevationM: number;
  /** Approximate cable length, m */
  cableLengthM: number;
  /** Sag-to-span ratio (dimensionless) */
  sagSpanRatio: number;
  /** Cable utilization = maxTension / (MBS / designFactor), fraction */
  utilization: number;
  /** Allowable working tension = MBS / designFactor, N */
  allowableTensionN: number;
  /** Profile points for plotting */
  profile: CableProfilePoint[];
  /** Solver warnings */
  warnings: string[];
  /** Solver assumptions used */
  assumptions: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// Solver
// ═══════════════════════════════════════════════════════════════════════

const MAX_ITER = 200;
const TOL = 1e-6; // relative convergence tolerance on H

/**
 * Solve horizontal tension H from pretension (max endpoint tension)
 * for a self-weight-only cable on a slope.
 */
function solveHFromPretension(
  spanM: number,
  elevDiffM: number,
  w: number,
  pretensionN: number,
): { H: number; converged: boolean; iterations: number } {
  let H = pretensionN; // initial guess
  for (let i = 0; i < MAX_ITER; i++) {
    // Vertical reaction at the higher support (left for backstay, depends on sign)
    const Vleft = (w * spanM) / 2 - (elevDiffM * H) / spanM;
    const Vright = (w * spanM) / 2 + (elevDiffM * H) / spanM;
    // Max tension is at the support with the larger |V|
    const Vmax = Math.max(Math.abs(Vleft), Math.abs(Vright));
    const Hnew = pretensionN / Math.sqrt(1 + (Vmax / H) ** 2);
    if (Math.abs(Hnew - H) / Math.max(H, 1e-12) < TOL) {
      return { H: Hnew, converged: true, iterations: i + 1 };
    }
    H = Hnew;
  }
  return { H, converged: false, iterations: MAX_ITER };
}

/**
 * Generate cable profile points.
 * y(x) = (w / 2H) * x * (L - x) + (h / L) * x + pointLoadDeflection
 */
function generateProfile(
  spanM: number,
  elevDiffM: number,
  w: number,
  H: number,
  pointLoad: PointLoadInput | undefined,
  nPoints: number,
): CableProfilePoint[] {
  const pts: CableProfilePoint[] = [];
  for (let i = 0; i <= nPoints; i++) {
    const x = (i / nPoints) * spanM;
    // Self-weight parabolic shape + linear slope
    let y = (w / (2 * H)) * x * (spanM - x) + (elevDiffM / spanM) * x;
    // Note: the parabolic term (w/2H)*x*(L-x) gives the SAG below the chord.
    // But since sag is downward and y is positive up, the sag SUBTRACTS from
    // the chord. Wait — let me re-derive:
    //
    // Chord line: y_chord(x) = (h/L)*x
    // Sag curve below chord: -w*x*(L-x)/(2H)
    // So y(x) = (h/L)*x - w*x*(L-x)/(2H)
    //
    // The sign in my equation above was WRONG. Fix:
    y = (elevDiffM / spanM) * x - (w / (2 * H)) * x * (spanM - x);

    // Point-load deflection
    if (pointLoad && pointLoad.forceN > 0) {
      const xP = pointLoad.positionM;
      const P = pointLoad.forceN;
      // Additional deflection from point load (simple beam analogy):
      if (x <= xP) {
        y -= (P * x * (spanM - xP)) / (H * spanM);
      } else {
        y -= (P * xP * (spanM - x)) / (H * spanM);
      }
    }
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Solve a single cable leg under the parabolic approximation.
 *
 * Coordinate convention: left support is at (0, 0), right support
 * is at (spanM, elevDiffM). For the main downhill leg, left = master
 * node (high), right = brake anchor (low), so elevDiffM is typically
 * negative.
 */
export function solveParabolicLeg(
  input: CableLegInput,
  pointLoad?: PointLoadInput,
  nProfilePoints = 100,
): CableLegResult {
  const warnings: string[] = [];
  const assumptions: string[] = [
    'A1: Parabolic approximation — load distributed per horizontal projection.',
    'A2: Cable is perfectly flexible (no bending stiffness).',
    'A3: Elastic elongation neglected.',
    'A4: Wind and temperature effects on geometry neglected.',
  ];

  const { spanM, elevDiffM, linearMassKgPerM, pretensionN, minBreakingStrengthN, designFactor } = input;

  // --- input guard ---
  if (spanM <= 0) throw new Error('Cable span must be positive.');
  if (linearMassKgPerM <= 0) throw new Error('Cable linear mass must be positive.');
  if (minBreakingStrengthN <= 0) throw new Error('MBS must be positive.');
  if (designFactor <= 0) throw new Error('Design factor must be positive.');

  const w = linearMassKgPerM * GRAVITY; // distributed load, N/m horizontal

  // --- solve H ---
  let H: number;
  if (input.horizontalTensionN && input.horizontalTensionN > 0) {
    H = input.horizontalTensionN;
    assumptions.push('H supplied directly (not from pretension).');
  } else if (pretensionN > 0) {
    const result = solveHFromPretension(spanM, elevDiffM, w, pretensionN);
    H = result.H;
    if (!result.converged) {
      warnings.push(`Pretension-to-H solver did not converge in ${MAX_ITER} iterations.`);
    }
  } else {
    throw new Error('Either pretensionN > 0 or horizontalTensionN > 0 is required.');
  }

  // Ensure H is meaningful
  if (H < 1) {
    warnings.push('Horizontal tension H < 1 N; cable is essentially slack.');
  }

  // --- vertical reactions ---
  let Vleft = (w * spanM) / 2 - (elevDiffM * H) / spanM;
  let Vright = (w * spanM) / 2 + (elevDiffM * H) / spanM;

  if (pointLoad && pointLoad.forceN > 0) {
    const xP = pointLoad.positionM;
    const P = pointLoad.forceN;
    if (xP < 0 || xP > spanM) {
      warnings.push('Point load position is outside the cable span.');
    }
    Vleft += (P * (spanM - xP)) / spanM;
    Vright += (P * xP) / spanM;
    assumptions.push(`Point load ${P.toFixed(1)} N applied at x = ${xP.toFixed(1)} m from left support.`);
  }

  // --- tensions ---
  const Tleft = Math.sqrt(H ** 2 + Vleft ** 2);
  const Tright = Math.sqrt(H ** 2 + Vright ** 2);
  const maxTension = Math.max(Tleft, Tright);

  // --- sag ---
  const midspanSag = (w * spanM ** 2) / (8 * H);
  const sagSpanRatio = midspanSag / spanM;

  // --- approximate length (numerically integrated along profile) ---
  // The standard formula S ≈ L*(1 + 8/3*(d/L)^2) assumes level supports.
  // For sloped cables we integrate along the profile instead.
  const profileForLength = generateProfile(spanM, elevDiffM, w, H, pointLoad, nProfilePoints);
  let cableLength = 0;
  for (let i = 1; i < profileForLength.length; i++) {
    const dx = profileForLength[i].x - profileForLength[i - 1].x;
    const dy = profileForLength[i].y - profileForLength[i - 1].y;
    cableLength += Math.sqrt(dx * dx + dy * dy);
  }

  // --- allowable tension and utilization ---
  const allowableTensionN = minBreakingStrengthN / designFactor;
  const utilization = maxTension / allowableTensionN;

  // --- profile ---
  const profile = generateProfile(spanM, elevDiffM, w, H, pointLoad, nProfilePoints);

  // --- find lowest point ---
  let lowestElevation = Infinity;
  for (const pt of profile) {
    if (pt.y < lowestElevation) lowestElevation = pt.y;
  }

  // --- warnings ---
  if (sagSpanRatio > 0.08) {
    warnings.push(
      `Sag/span ratio ${(sagSpanRatio * 100).toFixed(1)}% exceeds 8%. ` +
        'Parabolic approximation may be inaccurate; use catenary or segmented model.',
    );
  }
  const slopeAngle = Math.abs(Math.atan2(elevDiffM, spanM));
  if (slopeAngle > Math.PI / 6) {
    warnings.push(
      `Chord slope ${((slopeAngle * 180) / Math.PI).toFixed(1)}° exceeds 30°. ` +
        'Parabolic approximation is less accurate for steep cables.',
    );
  }
  if (utilization > 1.0) {
    warnings.push(`OVER CAPACITY: max tension ${maxTension.toFixed(0)} N exceeds allowable ${allowableTensionN.toFixed(0)} N.`);
  } else if (utilization > 0.8) {
    warnings.push(`Tension utilization ${(utilization * 100).toFixed(1)}% — approaching allowable limit.`);
  }

  return {
    horizontalTensionN: H,
    verticalReactionLeftN: Vleft,
    verticalReactionRightN: Vright,
    tensionLeftN: Tleft,
    tensionRightN: Tright,
    maxTensionN: maxTension,
    midspanSagM: midspanSag,
    lowestElevationM: lowestElevation,
    cableLengthM: cableLength,
    sagSpanRatio,
    utilization,
    allowableTensionN,
    profile,
    warnings,
    assumptions,
  };
}
