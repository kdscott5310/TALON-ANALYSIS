/**
 * Time-Step Trolley Dynamics Solver — Milestone 3
 *
 * Integrates trolley motion along the solved cable path with gravity,
 * rolling resistance, aerodynamic drag, along-track wind, and a
 * selectable progressive brake law, then audits the energy balance.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EQUATION OF MOTION (path coordinate s, speed v ≥ 0 along the path)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   m·dv/dt = −m·g·sinθ(s) − C_rr·m·g·cosθ(s)·[v>0]
 *             − ½·ρ·CdA·v_rel·|v_rel| − F_brake(s, v)      ... (1)
 *
 *   sinθ = y'/√(1+y'²),  cosθ = 1/√(1+y'²),  y' = dy/dx (path gradient)
 *   v_rel = v − v_wind   (v_wind + = tailwind along the track)
 *
 * Downhill gradients (y' < 0) make −m·g·sinθ positive (driving force).
 * Motion is one-directional: v is clamped at 0 (the trolley does not
 * roll backward; a stall before the brake zone is reported).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * BRAKE LAWS (engaged for s ≥ s_brakeStart, force opposes motion)
 * ═══════════════════════════════════════════════════════════════════════
 *   constant-force:          F = F₀
 *   linear-ramp:             F = F₀ · min(stroke / rampLength, 1)
 *   velocity-proportional:   F = c · v
 *
 * ═══════════════════════════════════════════════════════════════════════
 * INTEGRATION
 * ═══════════════════════════════════════════════════════════════════════
 * Classical RK4 with a fixed, user-configurable time step. Work terms
 * are accumulated per accepted step by the trapezoid rule:
 *   W += ½·(F(s₀,v₀) + F(s₁,v₁))·Δs
 * The residual of the energy balance is reported as the numerical
 * audit error and warned about when it exceeds 1% of the released
 * energy.
 *
 * ASSUMPTIONS
 *  D1. Point-mass trolley; payload pendulum dynamics neglected
 *      (out of Milestone-3 scope).
 *  D2. Quasi-static cable (path fixed during the run, per trolleyPath).
 *  D3. Rotating wheel inertia neglected.
 *  D4. Rolling resistance proportional to the normal force m·g·cosθ.
 *  D5. Brake force follows the selected idealized law; real hardware
 *      response requires manufacturer data.
 */

import { GRAVITY } from '../units/units';
import type { BrakeLaw } from '../models/scenario';
import type { TrolleyPath } from './trolleyPath';

export interface BrakeLawParams {
  law: BrakeLaw;
  /** F₀: constant force, or peak force at full ramp, N */
  forceN: number;
  /** Ramp length for linear-ramp, m (typically the available stroke) */
  rampLengthM: number;
  /** c for velocity-proportional, N·s/m */
  velocityCoeffNsPerM: number;
}

export interface SimulationInput {
  path: TrolleyPath;
  /** Total moving mass (trolley + test article), kg */
  massKg: number;
  /** Rolling-resistance coefficient, dimensionless */
  rollingResistanceCoeff: number;
  /** Aerodynamic drag area Cd·A, m² */
  dragAreaM2: number;
  /** Air density, kg/m³ */
  airDensityKgPerM3: number;
  /** Along-track wind, m/s (+ = tailwind pushing the trolley downhill) */
  alongTrackWindMps: number;
  /** Release arc-length position on the path, m */
  releaseSM: number;
  /** Release speed, m/s (≥ 0) */
  releaseSpeedMps: number;
  /** Arc-length where the brake engages, m */
  brakeStartSM: number;
  /** Available stopping distance beyond brake start, m */
  availableStrokeM: number;
  brake: BrakeLawParams;
  /** Integration time step, s */
  timeStepS: number;
  /** Simulation time limit, s */
  maxSimTimeS: number;
}

export type TerminationReason =
  | 'stopped-in-brake-zone'
  | 'stalled-before-brake'
  | 'end-of-path'
  | 'time-limit'
  | 'numerical-error';

export interface SimulationHistory {
  tS: number[];
  /** Path coordinate, m */
  sM: number[];
  /** Horizontal position, m */
  xM: number[];
  /** Path elevation relative to the high support, m */
  yM: number[];
  vMps: number[];
  aMps2: number[];
  brakeForceN: number[];
}

export interface EnergyAudit {
  /** m·g·(y_release − y_final): potential energy released, J */
  potentialReleasedJ: number;
  /** Kinetic energy at release, J */
  initialKineticJ: number;
  /** Kinetic energy at termination, J */
  finalKineticJ: number;
  /** Energy absorbed by the brake, J */
  brakeWorkJ: number;
  /** Energy removed by aerodynamic drag, J (negative = wind added energy) */
  dragWorkJ: number;
  /** Energy removed by rolling resistance, J */
  rollingWorkJ: number;
  /** Balance residual (should be ~0), J */
  auditErrorJ: number;
  /** Residual as a fraction of released + initial energy */
  auditErrorFrac: number;
}

export interface SimulationResult {
  termination: TerminationReason;
  history: SimulationHistory;
  /** Time of brake-zone entry, s (null if never reached) */
  brakeEntryTimeS: number | null;
  brakeEntrySpeedMps: number | null;
  brakeEntryKineticJ: number | null;
  /** Potential energy change from brake entry to final position, J (+ = descended) */
  brakeZonePotentialJ: number | null;
  peakSpeedMps: number;
  peakSpeedAtXM: number;
  /** Peak deceleration magnitude, m/s² */
  peakDecelMps2: number;
  peakBrakeForceN: number;
  /** Final position along path, m */
  finalSM: number;
  finalTimeS: number;
  /** Distance traveled inside the brake zone, m (null if never entered) */
  strokeUsedM: number | null;
  /** Speed remaining when the path or stroke ended, m/s (0 when stopped) */
  residualSpeedMps: number;
  energy: EnergyAudit;
  steps: number;
  timeStepUsedS: number;
  warnings: string[];
  assumptions: string[];
}

interface Forces {
  aMps2: number;
  brakeForceN: number;
}

function brakeForce(brake: BrakeLawParams, strokeM: number, v: number): number {
  if (v <= 0) return 0;
  switch (brake.law) {
    case 'constant-force':
      return brake.forceN;
    case 'linear-ramp': {
      const f = brake.rampLengthM > 0 ? Math.min(strokeM / brake.rampLengthM, 1) : 1;
      return brake.forceN * f;
    }
    case 'velocity-proportional':
      return brake.velocityCoeffNsPerM * v;
  }
}

export function simulateTrolley(input: SimulationInput): SimulationResult {
  const {
    path,
    massKg: m,
    rollingResistanceCoeff: crr,
    dragAreaM2,
    airDensityKgPerM3: rho,
    alongTrackWindMps: vWind,
    releaseSM,
    releaseSpeedMps,
    brakeStartSM,
    availableStrokeM,
    brake,
    timeStepS: dt,
    maxSimTimeS,
  } = input;

  // ── input guard: fail loudly, never silently ──
  if (!(m > 0)) throw new Error('Simulation: mass must be positive.');
  if (!(dt > 0)) throw new Error('Simulation: time step must be positive.');
  if (!(maxSimTimeS > 0)) throw new Error('Simulation: time limit must be positive.');
  if (!(crr >= 0)) throw new Error('Simulation: rolling-resistance coefficient must be ≥ 0.');
  if (!(dragAreaM2 >= 0)) throw new Error('Simulation: drag area must be ≥ 0.');
  if (!(rho > 0)) throw new Error('Simulation: air density must be positive.');
  if (!(releaseSpeedMps >= 0)) throw new Error('Simulation: release speed must be ≥ 0.');
  if (releaseSM < 0 || releaseSM >= path.totalLengthM)
    throw new Error('Simulation: release position is outside the path.');
  if (!(brake.forceN >= 0) || !(brake.velocityCoeffNsPerM >= 0))
    throw new Error('Simulation: brake parameters must be ≥ 0.');

  const warnings: string[] = [];
  const assumptions = [
    'D1: Point-mass trolley; payload pendulum dynamics neglected.',
    'D2: Quasi-static cable — path fixed during the run.',
    'D3: Rotating wheel inertia neglected.',
    'D4: Rolling resistance = C_rr · m · g · cosθ while moving.',
    'D5: Idealized brake law; real hardware response requires manufacturer data.',
    ...path.assumptions,
  ];

  const g = GRAVITY;
  const kDrag = 0.5 * rho * dragAreaM2;

  function forcesAt(s: number, v: number): Forces {
    const yp = path.slopeAtS(s);
    const invHyp = 1 / Math.sqrt(1 + yp * yp);
    const sinTh = yp * invHyp;
    const cosTh = invHyp;
    const vRel = v - vWind;
    const stroke = Math.max(0, s - brakeStartSM);
    const fb = s >= brakeStartSM ? brakeForce(brake, stroke, v) : 0;
    let a = -g * sinTh; // driving term (positive downhill)
    if (v > 0) a -= crr * g * cosTh; // rolling resistance opposes motion
    a -= (kDrag * vRel * Math.abs(vRel)) / m; // aero drag on relative wind
    a -= fb / m;
    return { aMps2: a, brakeForceN: fb };
  }

  // ── state ──
  let s = releaseSM;
  let v = releaseSpeedMps;
  let t = 0;
  let steps = 0;

  const history: SimulationHistory = { tS: [], sM: [], xM: [], yM: [], vMps: [], aMps2: [], brakeForceN: [] };
  const record = (a: number, fb: number) => {
    history.tS.push(t);
    history.sM.push(s);
    history.xM.push(path.xAtS(s));
    history.yM.push(path.yAtS(s));
    history.vMps.push(v);
    history.aMps2.push(a);
    history.brakeForceN.push(fb);
  };

  const y0 = path.yAtS(s);
  const initialKineticJ = 0.5 * m * v * v;

  let brakeEntryTimeS: number | null = null;
  let brakeEntrySpeedMps: number | null = null;
  let peakSpeed = v;
  let peakSpeedAtX = path.xAtS(s);
  let peakDecel = 0;
  let peakBrakeForce = 0;
  let brakeWorkJ = 0;
  let dragWorkJ = 0;
  let rollingWorkJ = 0;
  let termination: TerminationReason = 'time-limit';

  const f0 = forcesAt(s, v);
  record(f0.aMps2, f0.brakeForceN);

  // Immediate stall check: released from rest with no net driving force.
  if (v === 0 && f0.aMps2 <= 0) {
    warnings.push(
      'Trolley does not move: net force at the release point is not positive. ' +
        'Check release position, slope, and rolling resistance.',
    );
    return {
      termination: 'stalled-before-brake',
      history,
      brakeEntryTimeS: null,
      brakeEntrySpeedMps: null,
      brakeEntryKineticJ: null,
      brakeZonePotentialJ: null,
      peakSpeedMps: 0,
      peakSpeedAtXM: peakSpeedAtX,
      peakDecelMps2: 0,
      peakBrakeForceN: 0,
      finalSM: s,
      finalTimeS: 0,
      strokeUsedM: null,
      residualSpeedMps: 0,
      energy: {
        potentialReleasedJ: 0,
        initialKineticJ,
        finalKineticJ: initialKineticJ,
        brakeWorkJ: 0,
        dragWorkJ: 0,
        rollingWorkJ: 0,
        auditErrorJ: 0,
        auditErrorFrac: 0,
      },
      steps: 0,
      timeStepUsedS: dt,
      warnings,
      assumptions,
    };
  }

  const maxSteps = Math.ceil(maxSimTimeS / dt);

  for (steps = 1; steps <= maxSteps; steps++) {
    const s0 = s;
    const v0 = v;
    const F0 = forcesAt(s0, v0);

    // ── RK4 step on (s, v) ──
    const k1s = v0;
    const k1v = F0.aMps2;
    const k2s = v0 + 0.5 * dt * k1v;
    const k2v = forcesAt(s0 + 0.5 * dt * k1s, Math.max(0, v0 + 0.5 * dt * k1v)).aMps2;
    const k3s = v0 + 0.5 * dt * k2v;
    const k3v = forcesAt(s0 + 0.5 * dt * k2s, Math.max(0, v0 + 0.5 * dt * k2v)).aMps2;
    const k4s = v0 + dt * k3v;
    const k4v = forcesAt(s0 + dt * k3s, Math.max(0, v0 + dt * k3v)).aMps2;

    s = s0 + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);
    v = v0 + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    t += dt;

    if (!Number.isFinite(s) || !Number.isFinite(v)) {
      warnings.push('NUMERICAL ERROR: simulation state became non-finite. Reduce the time step.');
      termination = 'numerical-error';
      break;
    }

    // One-directional motion: clamp at rest.
    const stoppedThisStep = v <= 0;
    if (stoppedThisStep) v = 0;
    if (s > path.totalLengthM) s = path.totalLengthM;

    const F1 = forcesAt(s, v);

    // ── work accumulation (trapezoid over Δs) ──
    const ds = s - s0;
    if (ds > 0) {
      brakeWorkJ += 0.5 * (F0.brakeForceN + F1.brakeForceN) * ds;
      const drag0 = kDrag * (v0 - vWind) * Math.abs(v0 - vWind);
      const drag1 = kDrag * (v - vWind) * Math.abs(v - vWind);
      dragWorkJ += 0.5 * (drag0 + drag1) * ds;
      const yp0 = path.slopeAtS(s0);
      const yp1 = path.slopeAtS(s);
      const roll0 = v0 > 0 ? crr * m * g * (1 / Math.sqrt(1 + yp0 * yp0)) : 0;
      const roll1 = v > 0 ? crr * m * g * (1 / Math.sqrt(1 + yp1 * yp1)) : 0;
      rollingWorkJ += 0.5 * (roll0 + roll1) * ds;
    }

    // ── peaks ──
    if (v > peakSpeed) {
      peakSpeed = v;
      peakSpeedAtX = path.xAtS(s);
    }
    if (-F1.aMps2 > peakDecel) peakDecel = -F1.aMps2;
    if (F1.brakeForceN > peakBrakeForce) peakBrakeForce = F1.brakeForceN;

    // ── brake-zone entry ──
    if (brakeEntryTimeS === null && s >= brakeStartSM) {
      brakeEntryTimeS = t;
      brakeEntrySpeedMps = v;
    }

    record(F1.aMps2, F1.brakeForceN);

    // ── termination ──
    if (stoppedThisStep) {
      termination = s >= brakeStartSM ? 'stopped-in-brake-zone' : 'stalled-before-brake';
      break;
    }
    if (s >= path.totalLengthM) {
      termination = 'end-of-path';
      break;
    }
  }

  if (steps > maxSteps) {
    steps = maxSteps;
    warnings.push(
      `Simulation did not terminate within the ${maxSimTimeS} s time limit — ` +
        'non-convergent run. Check brake settings and geometry.',
    );
  }

  // ── energy audit ──
  const yEnd = path.yAtS(s);
  const potentialReleasedJ = m * g * (y0 - yEnd);
  const finalKineticJ = 0.5 * m * v * v;
  const auditErrorJ =
    potentialReleasedJ + initialKineticJ - finalKineticJ - brakeWorkJ - dragWorkJ - rollingWorkJ;
  const energyScale = Math.max(Math.abs(potentialReleasedJ) + initialKineticJ, 1);
  const auditErrorFrac = auditErrorJ / energyScale;
  if (Math.abs(auditErrorFrac) > 0.01) {
    warnings.push(
      `Energy audit residual ${(auditErrorFrac * 100).toFixed(2)}% exceeds 1% — ` +
        'numerical accuracy is degraded. Reduce the time step.',
    );
  }

  const brakeEntryKineticJ =
    brakeEntrySpeedMps !== null ? 0.5 * m * brakeEntrySpeedMps * brakeEntrySpeedMps : null;
  const brakeZonePotentialJ =
    brakeEntryTimeS !== null ? m * g * (path.yAtS(brakeStartSM) - yEnd) : null;
  const strokeUsedM = brakeEntryTimeS !== null ? s - brakeStartSM : null;

  // ── outcome warnings ──
  if (termination === 'end-of-path' || (strokeUsedM !== null && strokeUsedM > availableStrokeM)) {
    warnings.push(
      `STOPPING FAILURE: trolley ${termination === 'end-of-path' ? 'reached the end of the path' : 'exceeded the available stroke'} ` +
        `with ${v.toFixed(1)} m/s residual speed` +
        (strokeUsedM !== null ? ` (stroke used ${strokeUsedM.toFixed(1)} m vs ${availableStrokeM.toFixed(1)} m available)` : '') +
        '. Increase brake force or stopping distance.',
    );
  }
  if (termination === 'stalled-before-brake' && steps > 0) {
    warnings.push('Trolley stalled before reaching the brake zone.');
  }

  return {
    termination,
    history,
    brakeEntryTimeS,
    brakeEntrySpeedMps,
    brakeEntryKineticJ,
    brakeZonePotentialJ,
    peakSpeedMps: peakSpeed,
    peakSpeedAtXM: peakSpeedAtX,
    peakDecelMps2: peakDecel,
    peakBrakeForceN: peakBrakeForce,
    finalSM: s,
    finalTimeS: t,
    strokeUsedM,
    residualSpeedMps: v,
    energy: {
      potentialReleasedJ,
      initialKineticJ,
      finalKineticJ,
      brakeWorkJ,
      dragWorkJ,
      rollingWorkJ,
      auditErrorJ,
      auditErrorFrac,
    },
    steps,
    timeStepUsedS: dt,
    warnings,
    assumptions,
  };
}
