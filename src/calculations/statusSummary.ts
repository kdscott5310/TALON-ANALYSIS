/**
 * Scenario Status Summary — Milestone 4
 *
 * Runs the static solvers (swept over trolley positions) and the
 * dynamic simulation for a scenario and reduces the results to a set
 * of traceable check items with one of five statuses:
 *
 *   ok           acceptable preliminary margin
 *   caution      within margin but approaching a limit
 *   failed       a user-entered limit or physical check is violated
 *   insufficient required rating/limit not entered — NOT evaluated
 *                (never displayed as zero or acceptable)
 *   error        inputs invalid or a solver failed
 *
 * Each item carries traceability: units kind, the solver/model that
 * produced it, its main source inputs, and the applicable assumptions.
 */

import type { Scenario } from '../models/scenario';
import { validateScenario } from '../validation/validate';
import { runStaticAnalysis } from './staticAnalysis';
import { runDynamicsAnalysis } from './dynamicsAnalysis';
import { GRAVITY } from '../units/units';

export type CheckStatus = 'ok' | 'caution' | 'failed' | 'insufficient' | 'error';

export type ValueKind = 'force' | 'length' | 'speed' | 'ratio' | 'angle' | 'g' | 'sf' | 'text';

export interface SummaryItem {
  key: string;
  label: string;
  /** SI value; null when the check could not be evaluated */
  valueSI: number | null;
  kind: ValueKind;
  /** Display text for kind 'text' or overriding value formatting */
  text?: string;
  status: CheckStatus;
  /** Human explanation including the limit compared against */
  detail: string;
  /** Traceability: solver/model that produced the value */
  solver: string;
  /** Traceability: main source inputs */
  inputs: string;
  /** Traceability: applicable assumptions */
  assumptions: string;
}

export interface ScenarioSummary {
  scenarioName: string;
  overall: CheckStatus;
  items: SummaryItem[];
  validationErrorCount: number;
  validationWarningCount: number;
  criticalWarnings: string[];
  /** Set when the summary could not be computed at all */
  solverError: string | null;
}

const STATIC_SOLVER = 'Parabolic cable + master-node equilibrium (M2), swept over trolley positions';
const STATIC_ASSUME = 'Parabolic small-sag cable, H from unloaded pretension, quasi-static';
const DYN_SOLVER = 'RK4 path-following simulation (M3)';
const DYN_ASSUME = 'Point-mass trolley, quasi-static cable, idealized brake law';

/** Number of trolley positions in the static sweep (inclusive of ends). */
export const SWEEP_POSITIONS = 21;

function worst(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('insufficient')) return 'insufficient';
  if (statuses.includes('caution')) return 'caution';
  return 'ok';
}

function ratioStatus(value: number, cautionAt: number, failAt: number): CheckStatus {
  if (value >= failAt) return 'failed';
  if (value >= cautionAt) return 'caution';
  return 'ok';
}

export function summarizeScenario(scenario: Scenario): ScenarioSummary {
  const validation = validateScenario(scenario);
  const errorCount = validation.issues.filter((i) => i.severity === 'error').length;
  const warningCount = validation.issues.length - errorCount;

  if (!validation.isValid) {
    return {
      scenarioName: scenario.name,
      overall: 'error',
      items: [],
      validationErrorCount: errorCount,
      validationWarningCount: warningCount,
      criticalWarnings: validation.issues
        .filter((i) => i.severity === 'error')
        .map((i) => `${i.field}: ${i.message}`),
      solverError: `Inputs invalid (${errorCount} validation error${errorCount === 1 ? '' : 's'}) — results withheld.`,
    };
  }

  const items: SummaryItem[] = [];
  const criticalWarnings: string[] = [];

  // ── static sweep over trolley positions ──
  try {
    let peakCableUtil = -Infinity;
    let peakCraneUtil = -Infinity;
    let peakHookAngle = -Infinity;
    let minLaunchSlidingSF = Infinity;
    let minBrakeSlidingSF = Infinity;
    let minUpliftSF = Infinity;
    let minClearanceMargin = Infinity;
    let requiredSlidingSF = scenario.anchors.slidingSafetyFactor;

    for (let i = 0; i < SWEEP_POSITIONS; i++) {
      const frac = i / (SWEEP_POSITIONS - 1);
      const r = runStaticAnalysis({ scenario, trolleyPositionFrac: frac });
      peakCableUtil = Math.max(peakCableUtil, r.mainLegLoaded.utilization, r.backstay.utilization);
      peakCraneUtil = Math.max(peakCraneUtil, r.masterNode.craneUtilization);
      peakHookAngle = Math.max(peakHookAngle, r.masterNode.hookAngleDeg);
      minLaunchSlidingSF = Math.min(minLaunchSlidingSF, r.launchAnchor.slidingSF);
      minBrakeSlidingSF = Math.min(minBrakeSlidingSF, r.brakeAnchor.slidingSF);
      minUpliftSF = Math.min(minUpliftSF, r.launchAnchor.upliftSF, r.brakeAnchor.upliftSF);
      minClearanceMargin = Math.min(minClearanceMargin, r.groundClearanceMarginM);
    }

    items.push({
      key: 'cable-utilization',
      label: 'Peak cable utilization',
      valueSI: peakCableUtil,
      kind: 'ratio',
      status: ratioStatus(peakCableUtil, 0.8, 1.0),
      detail: `Peak tension / (MBS ÷ design factor); caution ≥ 80%, failed ≥ 100%.`,
      solver: STATIC_SOLVER,
      inputs: 'Cable MBS, design factor, pretension, geometry, moving mass',
      assumptions: STATIC_ASSUME,
    });
    items.push({
      key: 'crane-utilization',
      label: 'Peak crane utilization (with DAF)',
      valueSI: peakCraneUtil,
      kind: 'ratio',
      status: ratioStatus(peakCraneUtil, 0.85, 1.0),
      detail: 'DAF-amplified hook load / user-entered crane capacity; caution ≥ 85%, failed ≥ 100%.',
      solver: STATIC_SOLVER,
      inputs: 'Crane rated capacity (user chart), DAF, rigging mass, leg tensions',
      assumptions: STATIC_ASSUME,
    });
    items.push({
      key: 'hook-angle',
      label: 'Peak hook angle from vertical',
      valueSI: peakHookAngle,
      kind: 'angle',
      status: peakHookAngle > 5 ? 'failed' : peakHookAngle > 1 ? 'caution' : 'ok',
      detail: 'Side-load indicator; caution > 1°, failed > 5° (requires crane-company approval).',
      solver: STATIC_SOLVER,
      inputs: 'Leg tensions and geometry',
      assumptions: STATIC_ASSUME,
    });

    const sfStatus = (sf: number): CheckStatus =>
      sf < requiredSlidingSF ? 'failed' : sf < requiredSlidingSF * 1.25 ? 'caution' : 'ok';
    items.push({
      key: 'launch-anchor-sliding',
      label: 'Launch anchor sliding SF (min)',
      valueSI: minLaunchSlidingSF,
      kind: 'sf',
      status: sfStatus(minLaunchSlidingSF),
      detail: `Friction capacity / horizontal pull vs required SF ${requiredSlidingSF}.`,
      solver: STATIC_SOLVER,
      inputs: 'Block mass & count, friction coefficient (PROVISIONAL), backstay tension',
      assumptions: 'Rigid block cluster on level ground; friction requires field verification',
    });
    items.push({
      key: 'brake-anchor-sliding',
      label: 'Brake anchor sliding SF (min)',
      valueSI: minBrakeSlidingSF,
      kind: 'sf',
      status: sfStatus(minBrakeSlidingSF),
      detail: `Friction capacity / horizontal pull vs required SF ${requiredSlidingSF}.`,
      solver: STATIC_SOLVER,
      inputs: 'Block mass & count, friction coefficient (PROVISIONAL), main-leg tension',
      assumptions: 'Rigid block cluster on level ground; friction requires field verification',
    });
    items.push({
      key: 'anchor-uplift',
      label: 'Anchor uplift SF (min)',
      valueSI: Number.isFinite(minUpliftSF) ? minUpliftSF : null,
      kind: 'sf',
      text: Number.isFinite(minUpliftSF) ? undefined : 'no uplift',
      status: Number.isFinite(minUpliftSF) ? (minUpliftSF < 1.5 ? (minUpliftSF < 1 ? 'failed' : 'caution') : 'ok') : 'ok',
      detail: 'Anchor weight / vertical pull; failed < 1.0, caution < 1.5.',
      solver: STATIC_SOLVER,
      inputs: 'Block mass & count, cable end vertical reactions',
      assumptions: 'Anchor dead weight only; no soil anchors credited',
    });
    items.push({
      key: 'ground-clearance',
      label: 'Ground clearance margin (min)',
      valueSI: minClearanceMargin,
      kind: 'length',
      status:
        minClearanceMargin < 0
          ? 'failed'
          : minClearanceMargin < 0.2 * Math.max(scenario.site.minGroundClearanceM, 0.1)
            ? 'caution'
            : 'ok',
      detail: `Payload clearance minus required ${scenario.site.minGroundClearanceM.toFixed(1)} m minimum, worst trolley position.`,
      solver: STATIC_SOLVER,
      inputs: 'Loaded cable profile, payload drop, ground profile (linear interp)',
      assumptions: STATIC_ASSUME,
    });
  } catch (e) {
    return {
      scenarioName: scenario.name,
      overall: 'error',
      items,
      validationErrorCount: errorCount,
      validationWarningCount: warningCount,
      criticalWarnings: [],
      solverError: `Static solver error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // ── dynamics ──
  try {
    const dyn = runDynamicsAnalysis(scenario);
    const sim = dyn.sim;
    for (const w of dyn.warnings) if (w.severity === 'critical') criticalWarnings.push(w.message);

    const speedRatio = sim.peakSpeedMps / scenario.trolley.maxAllowableSpeedMps;
    items.push({
      key: 'peak-speed',
      label: 'Peak trolley speed',
      valueSI: sim.peakSpeedMps,
      kind: 'speed',
      status: ratioStatus(speedRatio, 0.9, 1.0),
      detail: `Vs max allowable ${scenario.trolley.maxAllowableSpeedMps.toFixed(1)} m/s; caution ≥ 90%.`,
      solver: DYN_SOLVER,
      inputs: 'Path slope, moving mass, C_rr, Cd·A, air density, wind',
      assumptions: DYN_ASSUME,
    });

    const decelRatio = sim.peakDecelMps2 / scenario.brake.maxDecelerationMps2;
    items.push({
      key: 'peak-decel',
      label: 'Peak deceleration',
      valueSI: sim.peakDecelMps2 / GRAVITY,
      kind: 'g',
      status: ratioStatus(decelRatio, 0.85, 1.0),
      detail: `Vs allowable ${(scenario.brake.maxDecelerationMps2 / GRAVITY).toFixed(2)} g; caution ≥ 85%.`,
      solver: DYN_SOLVER,
      inputs: 'Brake law and force, path slope, moving mass',
      assumptions: DYN_ASSUME,
    });

    const stopOk = sim.termination === 'stopped-in-brake-zone' &&
      (sim.strokeUsedM ?? Infinity) <= scenario.brake.availableStrokeM;
    items.push({
      key: 'stopping',
      label: 'Stops within available stroke',
      valueSI: sim.strokeUsedM,
      kind: 'length',
      text:
        sim.termination === 'stopped-in-brake-zone'
          ? undefined
          : sim.termination === 'end-of-path'
            ? 'OVERRAN'
            : sim.termination === 'stalled-before-brake'
              ? 'STALLED'
              : sim.termination.toUpperCase(),
      status:
        sim.termination === 'numerical-error' || sim.termination === 'time-limit'
          ? 'error'
          : stopOk
            ? 'ok'
            : 'failed',
      detail: `Stroke used vs ${scenario.brake.availableStrokeM.toFixed(1)} m available; residual speed ${sim.residualSpeedMps.toFixed(1)} m/s.`,
      solver: DYN_SOLVER,
      inputs: 'Brake law/force, brake-zone geometry, entry speed',
      assumptions: DYN_ASSUME,
    });

    items.push({
      key: 'brake-capacity',
      label: 'Brake capacity check',
      valueSI: scenario.brake.brakeCapacityN > 0 ? sim.peakBrakeForceN : null,
      kind: 'force',
      text: scenario.brake.brakeCapacityN > 0 ? undefined : 'NOT ENTERED',
      status:
        scenario.brake.brakeCapacityN > 0
          ? sim.peakBrakeForceN > scenario.brake.brakeCapacityN
            ? 'failed'
            : 'ok'
          : 'insufficient',
      detail:
        scenario.brake.brakeCapacityN > 0
          ? `Peak brake force vs entered capacity ${scenario.brake.brakeCapacityN.toFixed(0)} N.`
          : 'Brake hardware capacity not entered — check not evaluated.',
      solver: DYN_SOLVER,
      inputs: 'Brake capacity (user-entered hardware rating)',
      assumptions: 'Rating must come from manufacturer data — never inferred',
    });

    items.push({
      key: 'trolley-rating',
      label: 'Trolley structural check',
      valueSI: scenario.trolley.trolleyStructuralRatingN > 0 ? sim.peakBrakeForceN : null,
      kind: 'force',
      text: scenario.trolley.trolleyStructuralRatingN > 0 ? undefined : 'NOT ENTERED',
      status:
        scenario.trolley.trolleyStructuralRatingN > 0
          ? sim.peakBrakeForceN > scenario.trolley.trolleyStructuralRatingN
            ? 'failed'
            : 'ok'
          : 'insufficient',
      detail:
        scenario.trolley.trolleyStructuralRatingN > 0
          ? `Peak brake force vs trolley rating ${scenario.trolley.trolleyStructuralRatingN.toFixed(0)} N.`
          : 'Trolley structural rating not entered — check not evaluated.',
      solver: DYN_SOLVER,
      inputs: 'Trolley structural rating (user-entered)',
      assumptions: 'Rating must come from trolley design/proof test — never inferred',
    });

    items.push({
      key: 'energy-audit',
      label: 'Energy audit residual',
      valueSI: Math.abs(sim.energy.auditErrorFrac),
      kind: 'ratio',
      status: ratioStatus(Math.abs(sim.energy.auditErrorFrac), 0.005, 0.01),
      detail: 'Numerical integration quality; caution ≥ 0.5%, failed ≥ 1% (reduce time step).',
      solver: DYN_SOLVER,
      inputs: 'Time step, run length',
      assumptions: 'Trapezoid work accumulation over RK4 steps',
    });
  } catch (e) {
    return {
      scenarioName: scenario.name,
      overall: 'error',
      items,
      validationErrorCount: errorCount,
      validationWarningCount: warningCount,
      criticalWarnings,
      solverError: `Dynamics solver error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return {
    scenarioName: scenario.name,
    overall: worst(items.map((i) => i.status)),
    items,
    validationErrorCount: errorCount,
    validationWarningCount: warningCount,
    criticalWarnings,
    solverError: null,
  };
}
