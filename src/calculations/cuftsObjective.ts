/**
 * CUFTS objective adapter for optimization — Milestone 8C.
 *
 * Bridges the bounded/constrained optimizer (`optimization.ts`) to the
 * VALIDATED v1 CUFTS solvers: a design-variable vector is applied to a copy of
 * the scenario, the existing solvers are run unchanged, and scalar metrics are
 * read back. This module is purely additive — it does not modify any solver, so
 * v1 results are untouched (Rule 1). Evaluating the BASELINE vector reproduces
 * the current v1 results exactly; `cuftsObjective.test.ts` asserts that.
 *
 * Every evaluation is deterministic (Rule 9). An invalid scenario or a solver
 * failure yields a non-finite metric so the optimizer REJECTS the point rather
 * than scoring it (optimizer rule / R-6) — a failure is never a "best effort".
 */
import type { Scenario } from '../models/scenario';
import { runStaticAnalysis } from './staticAnalysis';
import { runDynamicsAnalysis } from './dynamicsAnalysis';
import { validateScenario } from '../validation/validate';

/** Design variables this adapter can apply to a CUFTS scenario. */
export type CuftsVariableKey =
  | 'pretensionN'
  | 'brakeForceN'
  | 'brakeZoneLengthM'
  | 'blocksPerAnchor'
  | 'designFactor';

export interface CuftsVariableSpec {
  key: CuftsVariableKey;
  label: string;
  /** SI unit label for display. */
  unit: string;
  /** Sensible bounds for the search; the UI may narrow them. */
  defaultMin: number;
  defaultMax: number;
  /** True when the value must be a whole number (e.g. block count). */
  integer?: boolean;
}

export const CUFTS_VARIABLES: readonly CuftsVariableSpec[] = [
  { key: 'pretensionN', label: 'Cable pretension', unit: 'N', defaultMin: 2000, defaultMax: 60000 },
  { key: 'brakeForceN', label: 'Brake force', unit: 'N', defaultMin: 500, defaultMax: 40000 },
  { key: 'brakeZoneLengthM', label: 'Brake zone length', unit: 'm', defaultMin: 5, defaultMax: 120 },
  { key: 'blocksPerAnchor', label: 'Ballast blocks per anchor', unit: 'count', defaultMin: 1, defaultMax: 40, integer: true },
  { key: 'designFactor', label: 'Cable design factor', unit: '—', defaultMin: 2, defaultMax: 10 },
];

/** Scalar metrics the optimizer can minimize or constrain. */
export interface CuftsMetrics {
  /** Peak cable tension over the loaded main leg, N. */
  peakTensionN: number;
  /** Cable utilization = peak tension × design factor / MBS (≤ 1 is adequate). */
  cableUtilization: number;
  /** Ground-clearance margin (positive = clearance requirement met), m. */
  groundClearanceMarginM: number;
  /** Peak trolley speed, m/s. */
  peakSpeedMps: number;
  /** Peak deceleration, g. */
  peakDecelG: number;
  /** Distance used inside the brake zone, m (Infinity when it never stopped). */
  strokeUsedM: number;
  /** Speed left when the path/stroke ended, m/s (0 = stopped). */
  residualSpeedMps: number;
  /** Peak brake force actually developed, N. */
  peakBrakeForceN: number;
  /** Anchor sliding safety margin (positive = adequate), dimensionless. */
  anchorSlidingMargin: number;
  /** Total ballast mass across both anchors, kg — a cost/logistics proxy. */
  ballastMassKg: number;
}

/** All metrics non-finite: signals "do not score this point" to the optimizer. */
function failedMetrics(): CuftsMetrics {
  const n = Number.NaN;
  return {
    peakTensionN: n, cableUtilization: n, groundClearanceMarginM: n, peakSpeedMps: n,
    peakDecelG: n, strokeUsedM: n, residualSpeedMps: n, peakBrakeForceN: n,
    anchorSlidingMargin: n, ballastMassKg: n,
  };
}

/** Applies a design-variable vector to a deep copy of the scenario. */
export function applyVariables(base: Scenario, x: Record<string, number>): Scenario {
  const s = JSON.parse(JSON.stringify(base)) as Scenario;
  for (const [key, value] of Object.entries(x)) {
    if (!Number.isFinite(value)) continue;
    switch (key as CuftsVariableKey) {
      case 'pretensionN':
        s.cable.pretensionN = value;
        break;
      case 'brakeForceN':
        s.brake.brakeForceN = value;
        break;
      case 'brakeZoneLengthM':
        s.site.brakeZoneLengthM = value;
        break;
      case 'blocksPerAnchor':
        // A block count is physically an integer; round rather than pretend.
        s.anchors.blocksPerAnchor = Math.max(1, Math.round(value));
        break;
      case 'designFactor':
        s.cable.designFactor = value;
        break;
    }
  }
  return s;
}

/**
 * Runs the validated v1 solvers on a scenario and extracts scalar metrics.
 * Returns non-finite metrics when the scenario is invalid or a solver throws,
 * so such points are rejected by the optimizer rather than scored.
 */
export function evaluateScenarioMetrics(scenario: Scenario): CuftsMetrics {
  // Blocking errors mean the point is not a real design — reject, never score.
  if (!validateScenario(scenario).isValid) return failedMetrics();

  try {
    // Static sweep at the mid-span trolley position (worst-ish for sag/tension),
    // plus the full dynamic run for speed/braking metrics.
    const statics = runStaticAnalysis({ scenario, trolleyPositionFrac: 0.5 });
    const dyn = runDynamicsAnalysis(scenario);

    const peakTensionN = Math.max(
      statics.mainLegLoaded.maxTensionN,
      statics.backstay.maxTensionN,
    );
    const mbs = scenario.cable.minBreakingStrengthN;
    const cableUtilization = mbs > 0 ? (peakTensionN * scenario.cable.designFactor) / mbs : Number.NaN;

    const ballastMassKg =
      2 * scenario.anchors.blocksPerAnchor * scenario.anchors.blockMassKg;

    // Anchor sliding margin: available friction / demand − required SF.
    // A negative value means the anchor does not meet the required factor.
    const slide = statics.brakeAnchor;
    const anchorSlidingMargin = Number.isFinite(slide.slidingSF)
      ? slide.slidingSF - scenario.anchors.slidingSafetyFactor
      : Number.NaN;

    return {
      peakTensionN,
      cableUtilization,
      groundClearanceMarginM: statics.groundClearanceMarginM,
      peakSpeedMps: dyn.sim.peakSpeedMps,
      peakDecelG: dyn.peakDecelG,
      // Never stopping is reported as an infinite stroke — never as a small number.
      strokeUsedM: dyn.sim.strokeUsedM ?? Number.POSITIVE_INFINITY,
      residualSpeedMps: dyn.sim.residualSpeedMps,
      peakBrakeForceN: dyn.sim.peakBrakeForceN,
      anchorSlidingMargin,
      ballastMassKg,
    };
  } catch {
    return failedMetrics();
  }
}

/** Convenience: apply a variable vector to the base scenario and evaluate it. */
export function evaluateVariables(base: Scenario, x: Record<string, number>): CuftsMetrics {
  return evaluateScenarioMetrics(applyVariables(base, x));
}

// ── objectives & constraints for the optimizer ──────────────────────────────

export type CuftsObjectiveKey =
  | 'peakTension'
  | 'stoppingDistance'
  | 'peakSpeed'
  | 'ballastMass'
  | 'peakDecel';

export interface CuftsObjectiveSpec {
  key: CuftsObjectiveKey;
  label: string;
  /** Reads the scalar to MINIMIZE from the metrics. */
  read: (m: CuftsMetrics) => number;
}

export const CUFTS_OBJECTIVES: readonly CuftsObjectiveSpec[] = [
  { key: 'peakTension', label: 'Minimize peak cable tension', read: (m) => m.peakTensionN },
  { key: 'stoppingDistance', label: 'Minimize stopping distance (brake stroke used)', read: (m) => m.strokeUsedM },
  { key: 'peakSpeed', label: 'Minimize peak trolley speed', read: (m) => m.peakSpeedMps },
  { key: 'ballastMass', label: 'Minimize ballast mass', read: (m) => m.ballastMassKg },
  { key: 'peakDecel', label: 'Minimize peak deceleration', read: (m) => m.peakDecelG },
];

export interface CuftsConstraintSpec {
  key: string;
  label: string;
  /** g(metrics) ≤ 0 is satisfied. */
  read: (m: CuftsMetrics, limits: CuftsLimits) => number;
}

export interface CuftsLimits {
  /** Maximum acceptable cable utilization (default 1 = at the design factor). */
  maxCableUtilization: number;
  /** Maximum acceptable peak deceleration, g. */
  maxDecelG: number;
  /** Maximum trolley speed, m/s. */
  maxSpeedMps: number;
  /** Available brake stroke, m — the stop must fit inside it. */
  availableStrokeM: number;
}

export const CUFTS_CONSTRAINTS: readonly CuftsConstraintSpec[] = [
  {
    key: 'cableUtilization',
    label: 'Cable utilization within the design factor',
    read: (m, l) => m.cableUtilization - l.maxCableUtilization,
  },
  {
    key: 'groundClearance',
    label: 'Ground clearance requirement met',
    read: (m) => -m.groundClearanceMarginM, // margin ≥ 0  ⇔  −margin ≤ 0
  },
  {
    key: 'mustStop',
    label: 'Trolley comes to rest',
    read: (m) => m.residualSpeedMps, // any residual speed violates
  },
  {
    key: 'strokeFits',
    label: 'Stop fits within the available brake stroke',
    read: (m, l) => m.strokeUsedM - l.availableStrokeM,
  },
  {
    key: 'decelLimit',
    label: 'Peak deceleration within limit',
    read: (m, l) => m.peakDecelG - l.maxDecelG,
  },
  {
    key: 'speedLimit',
    label: 'Peak speed within limit',
    read: (m, l) => m.peakSpeedMps - l.maxSpeedMps,
  },
  {
    key: 'anchorSliding',
    label: 'Anchor meets the required sliding safety factor',
    read: (m) => -m.anchorSlidingMargin, // margin ≥ 0
  },
];
