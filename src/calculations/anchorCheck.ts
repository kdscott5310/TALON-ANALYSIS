/**
 * Anchor Sliding and Uplift Check — Milestone 2
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EQUATIONS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Sliding resistance:
 *   F_resist = μ * W_anchor
 *   SF_sliding = F_resist / F_horizontal
 *
 * Uplift check:
 *   SF_uplift = W_anchor / F_vertical_up
 *   (only applicable if the cable pulls upward on the anchor)
 *
 * All values are user-entered. No manufactured data is assumed.
 */

import { GRAVITY } from '../units/units';

export interface AnchorCheckInput {
  label: string;
  /** Horizontal force on the anchor, N (positive = pulls outward) */
  horizontalForceN: number;
  /** Vertical force on the anchor, N (positive = pulls upward, i.e., uplift) */
  verticalForceUpN: number;
  /** Number of ecology blocks */
  blocksPerAnchor: number;
  /** Mass per block, kg */
  blockMassKg: number;
  /** Ground friction coefficient */
  frictionCoefficient: number;
  /** Required safety factor against sliding */
  requiredSlidingSF: number;
}

export interface AnchorCheckResult {
  label: string;
  /** Total anchor weight, N */
  anchorWeightN: number;
  /** Net normal force on ground (weight minus uplift), N */
  netNormalForceN: number;
  /** Available sliding resistance, N */
  slidingResistanceN: number;
  /** Safety factor against sliding */
  slidingSF: number;
  /** Safety factor against uplift (weight / vertical pull). Infinity if no uplift. */
  upliftSF: number;
  /** Pass/fail for sliding */
  slidingOk: boolean;
  /** Pass/fail for uplift */
  upliftOk: boolean;
  warnings: string[];
}

export function checkAnchor(input: AnchorCheckInput): AnchorCheckResult {
  const warnings: string[] = [];
  const {
    label,
    horizontalForceN,
    verticalForceUpN,
    blocksPerAnchor,
    blockMassKg,
    frictionCoefficient,
    requiredSlidingSF,
  } = input;

  const anchorWeight = blocksPerAnchor * blockMassKg * GRAVITY;

  // Net normal force: anchor weight minus any uplift
  const netNormal = anchorWeight - Math.max(verticalForceUpN, 0);

  // Sliding resistance uses net normal force (reduced by uplift)
  const slidingResistance = frictionCoefficient * Math.max(netNormal, 0);

  const absHorizontal = Math.abs(horizontalForceN);
  const slidingSF = absHorizontal > 1e-6 ? slidingResistance / absHorizontal : Infinity;

  const upliftSF = verticalForceUpN > 1e-6 ? anchorWeight / verticalForceUpN : Infinity;

  const slidingOk = slidingSF >= requiredSlidingSF;
  const upliftOk = upliftSF >= requiredSlidingSF; // use same SF for uplift

  if (!slidingOk) {
    warnings.push(
      `${label}: sliding SF ${slidingSF.toFixed(2)} is below required ${requiredSlidingSF.toFixed(1)}. ` +
        'Add blocks, improve friction, or add ground anchors.',
    );
  }
  if (!upliftOk) {
    warnings.push(
      `${label}: uplift SF ${upliftSF.toFixed(2)} is below required ${requiredSlidingSF.toFixed(1)}. ` +
        'Anchor may lift off the ground.',
    );
  }
  if (netNormal < 0) {
    warnings.push(`${label}: net normal force is negative — anchor is being pulled off the ground!`);
  }

  return {
    label,
    anchorWeightN: anchorWeight,
    netNormalForceN: netNormal,
    slidingResistanceN: slidingResistance,
    slidingSF,
    upliftSF,
    slidingOk,
    upliftOk,
    warnings,
  };
}
