/**
 * Master-Ring Vector Equilibrium — Milestone 2
 *
 * Combines forces from the backstay (launch leg), main (test) leg,
 * rigging weight, and trolley effects to compute the crane hook
 * resultant and capacity margin.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * COORDINATE SYSTEM
 * ═══════════════════════════════════════════════════════════════════════
 * Origin at the master node. x = horizontal downrange (toward brake
 * anchor), y = vertical upward.
 *
 * The backstay pulls the node toward negative-x and downward.
 * The main leg pulls the node toward positive-x and downward.
 * Rigging weight acts straight down.
 * The crane hook provides the upward + horizontal reaction needed
 * for equilibrium.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EQUATIONS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Each cable leg exerts a force on the node equal to the resultant
 * tension AT THE NODE END of that leg, directed AWAY from the node
 * along the cable tangent.
 *
 * For the parabolic approximation the tangent angle at the node-end
 * support is:
 *   tan(θ) = V / H
 * where V is the vertical reaction at that endpoint and H is the
 * horizontal tension.
 *
 * Backstay (from node to launch anchor, direction = negative x):
 *   F_bx = −H_backstay              (pulls node toward launch anchor)
 *   F_by = −V_backstay_at_node      (pulls node downward)
 *
 * Main leg (from node to brake anchor, direction = positive x):
 *   F_mx = +H_main                  (pulls node toward brake anchor)
 *   F_my = −V_main_at_node          (pulls node downward)
 *
 * Rigging weight:
 *   F_rx = 0
 *   F_ry = −W_rigging               (downward)
 *
 * Hook must supply the equilibrium reaction:
 *   F_hook_x = −(F_bx + F_mx + F_rx)
 *   F_hook_y = −(F_by + F_my + F_ry)
 *
 * Positive F_hook_y = upward (normal).
 * F_hook_x ≠ 0 means the hook has a side/horizontal component — this
 * is a side-load concern that requires crane-company approval.
 */

import { GRAVITY } from '../units/units';
import type { CableLegResult } from './parabolicCable';

export interface MasterNodeInput {
  /** Backstay solver result (left support = launch anchor, right = node) */
  backstay: CableLegResult;
  /** Main leg solver result (left support = node, right = brake anchor) */
  mainLeg: CableLegResult;
  /** Rigging + master ring + load cell mass, kg */
  riggingMassKg: number;
  /** User-entered crane rated capacity at radius, N */
  craneRatedCapacityN: number;
  /** Preliminary dynamic amplification factor (≥ 1) */
  dynamicAmplificationFactor: number;
}

export interface ForceVector {
  fx: number; // N, positive = downrange
  fy: number; // N, positive = upward
}

export interface MasterNodeResult {
  /** Force exerted by the backstay on the node */
  backstayForce: ForceVector;
  /** Force exerted by the main leg on the node */
  mainLegForce: ForceVector;
  /** Rigging weight vector */
  riggingWeight: ForceVector;
  /** Required crane hook reaction (for equilibrium) */
  hookReaction: ForceVector;
  /** Hook resultant magnitude, N */
  hookResultantN: number;
  /** Hook resultant angle from vertical, degrees (0 = vertical, >0 = off-plumb) */
  hookAngleDeg: number;
  /** Hook resultant with dynamic amplification applied, N */
  dynamicHookLoadN: number;
  /** Crane utilization = dynamicHookLoad / ratedCapacity */
  craneUtilization: number;
  /** Included angle between backstay and main leg, degrees */
  includedAngleDeg: number;
  /** Warnings */
  warnings: string[];
}

function vecMag(v: ForceVector): number {
  return Math.sqrt(v.fx ** 2 + v.fy ** 2);
}

function angleBetween(a: ForceVector, b: ForceVector): number {
  const dot = a.fx * b.fx + a.fy * b.fy;
  const magA = vecMag(a);
  const magB = vecMag(b);
  if (magA < 1e-12 || magB < 1e-12) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

export function solveMasterNode(input: MasterNodeInput): MasterNodeResult {
  const { backstay, mainLeg, riggingMassKg, craneRatedCapacityN, dynamicAmplificationFactor } = input;
  const warnings: string[] = [];

  // The backstay result has left = launch anchor, right = node.
  // At the node (right support), the cable pulls DOWN and toward
  // the launch anchor (negative x).
  // V_right of the backstay is the vertical reaction at the right
  // support. The cable exerts that force downward on the node:
  const backstayForce: ForceVector = {
    fx: -backstay.horizontalTensionN,          // pulls toward launch anchor
    fy: -backstay.verticalReactionRightN,      // pulls down
  };

  // The main leg result has left = node, right = brake anchor.
  // At the node (left support), the cable pulls DOWN and toward
  // the brake anchor (positive x).
  const mainLegForce: ForceVector = {
    fx: mainLeg.horizontalTensionN,            // pulls toward brake anchor
    fy: -mainLeg.verticalReactionLeftN,        // pulls down
  };

  const riggingWeight: ForceVector = {
    fx: 0,
    fy: -(riggingMassKg * GRAVITY),
  };

  // Equilibrium: sum of all forces on node = 0
  // hookReaction = -(backstay + mainLeg + rigging)
  const hookReaction: ForceVector = {
    fx: -(backstayForce.fx + mainLegForce.fx + riggingWeight.fx),
    fy: -(backstayForce.fy + mainLegForce.fy + riggingWeight.fy),
  };

  const hookResultant = vecMag(hookReaction);

  // Angle from vertical
  const hookAngleDeg =
    hookResultant > 1e-6
      ? (Math.atan2(Math.abs(hookReaction.fx), hookReaction.fy) * 180) / Math.PI
      : 0;

  // Dynamic hook load
  const dynamicHookLoad = hookResultant * dynamicAmplificationFactor;

  // Crane utilization
  const craneUtilization = craneRatedCapacityN > 0 ? dynamicHookLoad / craneRatedCapacityN : Infinity;

  // Included angle between cable legs at the node
  const includedAngle = angleBetween(backstayForce, mainLegForce);

  // --- Warnings ---
  if (hookReaction.fy < 0) {
    warnings.push('CRITICAL: Hook reaction is DOWNWARD — geometry error or unstable configuration.');
  }
  if (hookAngleDeg > 5) {
    warnings.push(
      `Hook resultant is ${hookAngleDeg.toFixed(1)}° from vertical. ` +
        'Side-load condition — requires crane-company approval.',
    );
  } else if (hookAngleDeg > 1) {
    warnings.push(
      `Hook resultant is ${hookAngleDeg.toFixed(1)}° from vertical (minor off-plumb).`,
    );
  }
  if (craneUtilization > 1.0) {
    warnings.push(
      `OVER CAPACITY: dynamic hook load exceeds crane rated capacity ` +
        `(${(craneUtilization * 100).toFixed(1)}% utilization).`,
    );
  } else if (craneUtilization > 0.85) {
    warnings.push(
      `Crane utilization ${(craneUtilization * 100).toFixed(1)}% — limited margin remaining.`,
    );
  }
  if (includedAngle < 30) {
    warnings.push(
      `Included angle between legs is ${includedAngle.toFixed(1)}° — ` +
        'small included angle increases hook load. Verify geometry.',
    );
  }

  return {
    backstayForce,
    mainLegForce,
    riggingWeight,
    hookReaction,
    hookResultantN: hookResultant,
    hookAngleDeg,
    dynamicHookLoadN: dynamicHookLoad,
    craneUtilization,
    includedAngleDeg: includedAngle,
    warnings,
  };
}
