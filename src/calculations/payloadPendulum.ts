/**
 * Damped payload pendulum — Milestone 9. **Fidelity Level 2 (reduced-order).**
 *
 * The suspended payload is modeled as a damped spherical pendulum hanging below
 * the trolley, with two decoupled planar modes:
 *
 *   Longitudinal (pitch, in the plane of travel): forced by the trolley's
 *   along-track acceleration and braking deceleration.
 *   Lateral (sway, out of plane): forced by crosswind and gust drag on the
 *   payload.
 *
 * Equation of motion for each mode (angle θ from vertical, suspension L):
 *
 *   θ'' + 2·ζ·ω_n·θ' + ω_n²·sin θ = −(a_drive/L)·cos θ
 *
 * with ω_n = sqrt(g/L). In the small-angle limit this is the classical damped
 * pendulum whose natural period is T = 2π·sqrt(L/g) — asserted in the tests.
 *
 * a_drive is the horizontal base acceleration of the SUPPORT (the trolley):
 *   longitudinal — the trolley's along-track acceleration a(t),
 *   lateral      — the crosswind drag acceleration on the payload,
 *                  a_wind = ½·ρ·Cd·A·(v_wind − v_payload)²/m_payload.
 *
 * Integrated with fixed-step RK4. Deterministic (Rule 9). Reduced-order: the
 * cable is treated as a massless rigid link of fixed length; coupling back into
 * the cable dynamics is the Milestone 11 model (Rule 11).
 */

import { GRAVITY } from '../units/units';

export interface PendulumTimeSample {
  /** Along-track base acceleration of the trolley at this time, m/s². */
  tS: number;
  aAlongTrackMps2: number;
}

export interface PayloadPendulumInput {
  /** Suspension length below the trolley, m (> 0). */
  suspensionLengthM: number;
  /** Payload mass, kg (> 0). */
  payloadMassKg: number;
  /** Damping ratio ζ, dimensionless (≥ 0). */
  dampingRatio: number;
  /** Initial longitudinal (pitch) angle from vertical, rad. */
  initialPitchRad?: number;
  /** Initial lateral (sway) angle from vertical, rad. */
  initialSwayRad?: number;
  /** Steady crosswind speed, m/s (drives lateral sway). */
  crosswindMps?: number;
  /** Gust speed added to the crosswind for a worst-case lateral drive, m/s. */
  gustMps?: number;
  /** Air density, kg/m³ (default 1.225). */
  airDensityKgPerM3?: number;
  /** Payload drag area Cd·A for wind loading, m². */
  payloadDragAreaM2?: number;
  /** Along-track acceleration history of the trolley (from the M3/M9 run). */
  accelerationHistory: PendulumTimeSample[];
  /** Integration time step, s (default 0.005). */
  timeStepS?: number;
  /** Maximum permitted sway/pitch angle, rad — for the collision/limit check. */
  maxPermittedAngleRad?: number;
  /** Ground clearance below the payload at rest, m — for the collision check. */
  restGroundClearanceM?: number;
}

export interface PendulumHistory {
  tS: number[];
  pitchRad: number[];
  swayRad: number[];
  /** Longitudinal horizontal displacement of the payload from vertical, m. */
  longitudinalDispM: number[];
  /** Lateral horizontal displacement, m. */
  lateralDispM: number[];
  /** Total swing angle (combined pitch+sway) from vertical, rad. */
  totalAngleRad: number[];
}

export interface PayloadPendulumResult {
  history: PendulumHistory;
  /** Peak longitudinal pitch angle magnitude, rad. */
  peakPitchRad: number;
  /** Peak lateral sway angle magnitude, rad. */
  peakSwayRad: number;
  /** Peak combined swing angle from vertical, rad. */
  peakTotalAngleRad: number;
  /** Peak horizontal displacement of the payload from the rest point, m. */
  peakDisplacementM: number;
  /** Natural period of the pendulum, s. */
  naturalPeriodS: number;
  /** Time for the swing envelope to decay to 5% of its peak, s (null if undamped). */
  settlingTimeS: number | null;
  /** Peak horizontal reaction at the attachment point, N. */
  peakAttachmentReactionN: number;
  /** Minimum ground clearance of the swinging payload, m (null if not supplied). */
  minGroundClearanceM: number | null;
  assumptions: string[];
  warnings: string[];
  /** Set when inputs are invalid; the result must not be used. */
  failureReason?: string;
}

const ASSUMPTIONS = [
  'P1: Payload is a point mass on a massless rigid link of fixed length.',
  'P2: Longitudinal and lateral modes are decoupled (small out-of-plane coupling neglected).',
  'P3: Reduced-order — the cable and trolley are rigid supports; no feedback into cable dynamics.',
  'P4: Aerodynamic drag uses a constant Cd·A on the relative wind.',
];

/** Interpolates the trolley acceleration history at time t. */
function accelAt(history: PendulumTimeSample[], t: number): number {
  if (history.length === 0) return 0;
  if (t <= history[0].tS) return history[0].aAlongTrackMps2;
  const last = history[history.length - 1];
  if (t >= last.tS) return last.aAlongTrackMps2;
  let lo = 0;
  let hi = history.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (history[mid].tS <= t) lo = mid;
    else hi = mid;
  }
  const a = history[lo];
  const b = history[hi];
  const f = (t - a.tS) / (b.tS - a.tS);
  return a.aAlongTrackMps2 + f * (b.aAlongTrackMps2 - a.aAlongTrackMps2);
}

export function solvePayloadPendulum(input: PayloadPendulumInput): PayloadPendulumResult {
  const warnings: string[] = [];
  const fail = (reason: string): PayloadPendulumResult => ({
    history: { tS: [], pitchRad: [], swayRad: [], longitudinalDispM: [], lateralDispM: [], totalAngleRad: [] },
    peakPitchRad: NaN,
    peakSwayRad: NaN,
    peakTotalAngleRad: NaN,
    peakDisplacementM: NaN,
    naturalPeriodS: NaN,
    settlingTimeS: null,
    peakAttachmentReactionN: NaN,
    minGroundClearanceM: null,
    assumptions: ASSUMPTIONS,
    warnings: [reason],
    failureReason: reason,
  });

  const L = input.suspensionLengthM;
  const m = input.payloadMassKg;
  const zeta = input.dampingRatio;
  if (!Number.isFinite(L) || L <= 0) return fail('Suspension length must be a positive, finite number.');
  if (!Number.isFinite(m) || m <= 0) return fail('Payload mass must be a positive, finite number.');
  if (!Number.isFinite(zeta) || zeta < 0) return fail('Damping ratio must be finite and ≥ 0.');

  const dt = input.timeStepS ?? 0.005;
  if (!Number.isFinite(dt) || dt <= 0) return fail('Time step must be a positive, finite number.');
  const g = GRAVITY;
  const wn = Math.sqrt(g / L);
  const naturalPeriod = (2 * Math.PI) / wn;

  const history = input.accelerationHistory ?? [];
  const tEnd = history.length > 0 ? history[history.length - 1].tS : 5 * naturalPeriod;
  // Simulate at least a few natural periods so a free swing settles/reports.
  const simEnd = Math.max(tEnd, 4 * naturalPeriod);

  // Constant lateral drive from wind drag (worst-case: steady + gust).
  const rho = input.airDensityKgPerM3 ?? 1.225;
  const CdA = input.payloadDragAreaM2 ?? 0;
  const windMps = (input.crosswindMps ?? 0) + (input.gustMps ?? 0);
  // Base acceleration equivalent of the wind force on the payload, m/s².
  const lateralWindAccel = CdA > 0 ? (0.5 * rho * CdA * windMps * windMps) / m : 0;

  // State: [pitch, pitchDot, sway, swayDot]
  let pitch = input.initialPitchRad ?? 0;
  let pitchDot = 0;
  let sway = input.initialSwayRad ?? 0;
  let swayDot = 0;

  const hist: PendulumHistory = {
    tS: [], pitchRad: [], swayRad: [], longitudinalDispM: [], lateralDispM: [], totalAngleRad: [],
  };

  /** Angular acceleration for one mode. */
  const angAcc = (theta: number, thetaDot: number, driveAccel: number): number =>
    -2 * zeta * wn * thetaDot - wn * wn * Math.sin(theta) - (driveAccel / L) * Math.cos(theta);

  let peakPitch = Math.abs(pitch);
  let peakSway = Math.abs(sway);
  let peakTotal = 0;
  let peakDisp = 0;
  let peakReaction = 0;
  let minClearance = input.restGroundClearanceM ?? Infinity;

  const record = (t: number) => {
    const longDisp = L * Math.sin(pitch);
    const latDisp = L * Math.sin(sway);
    const total = Math.sqrt(pitch * pitch + sway * sway);
    hist.tS.push(t);
    hist.pitchRad.push(pitch);
    hist.swayRad.push(sway);
    hist.longitudinalDispM.push(longDisp);
    hist.lateralDispM.push(latDisp);
    hist.totalAngleRad.push(total);

    peakPitch = Math.max(peakPitch, Math.abs(pitch));
    peakSway = Math.max(peakSway, Math.abs(sway));
    peakTotal = Math.max(peakTotal, total);
    const disp = Math.hypot(longDisp, latDisp);
    peakDisp = Math.max(peakDisp, disp);
    // Horizontal reaction ≈ m·g·tan(total) for a quasi-static swing.
    peakReaction = Math.max(peakReaction, m * g * Math.abs(Math.tan(Math.min(total, 1.4))));
    if (input.restGroundClearanceM !== undefined) {
      // Payload rises as it swings: clearance increases. The worst (minimum)
      // clearance is at rest, but a large drop below the trolley plane can be
      // reported if the payload swings toward a lower obstacle — conservatively
      // track the vertical rise.
      const rise = L * (1 - Math.cos(total));
      minClearance = Math.min(minClearance, input.restGroundClearanceM + rise);
    }
  };

  record(0);
  const nSteps = Math.ceil(simEnd / dt);
  for (let i = 1; i <= nSteps; i++) {
    const t0 = (i - 1) * dt;
    const aTrolley0 = accelAt(history, t0);
    const aTrolley1 = accelAt(history, t0 + dt);
    const aTrolleyH = accelAt(history, t0 + dt / 2);

    // RK4 on the 4-state vector.
    const deriv = (p: number, pd: number, s: number, sd: number, aLong: number) => ({
      p: pd,
      pd: angAcc(p, pd, aLong),
      s: sd,
      sd: angAcc(s, sd, lateralWindAccel),
    });

    const k1 = deriv(pitch, pitchDot, sway, swayDot, aTrolley0);
    const k2 = deriv(
      pitch + 0.5 * dt * k1.p, pitchDot + 0.5 * dt * k1.pd,
      sway + 0.5 * dt * k1.s, swayDot + 0.5 * dt * k1.sd, aTrolleyH,
    );
    const k3 = deriv(
      pitch + 0.5 * dt * k2.p, pitchDot + 0.5 * dt * k2.pd,
      sway + 0.5 * dt * k2.s, swayDot + 0.5 * dt * k2.sd, aTrolleyH,
    );
    const k4 = deriv(
      pitch + dt * k3.p, pitchDot + dt * k3.pd,
      sway + dt * k3.s, swayDot + dt * k3.sd, aTrolley1,
    );

    pitch += (dt / 6) * (k1.p + 2 * k2.p + 2 * k3.p + k4.p);
    pitchDot += (dt / 6) * (k1.pd + 2 * k2.pd + 2 * k3.pd + k4.pd);
    sway += (dt / 6) * (k1.s + 2 * k2.s + 2 * k3.s + k4.s);
    swayDot += (dt / 6) * (k1.sd + 2 * k2.sd + 2 * k3.sd + k4.sd);

    if (!Number.isFinite(pitch) || !Number.isFinite(sway)) {
      return fail('Pendulum integration became non-finite; reduce the time step.');
    }
    record(i * dt);
  }

  // Settling time: last time the total-angle envelope exceeds 5% of its peak.
  let settlingTimeS: number | null = null;
  if (peakTotal > 0) {
    const threshold = 0.05 * peakTotal;
    for (let i = hist.totalAngleRad.length - 1; i >= 0; i--) {
      if (hist.totalAngleRad[i] > threshold) {
        settlingTimeS = hist.tS[i];
        break;
      }
    }
    if (zeta === 0) settlingTimeS = null; // undamped never settles
  } else {
    settlingTimeS = 0;
  }

  // ── warnings and limit checks ──
  const maxAngle = input.maxPermittedAngleRad;
  if (maxAngle !== undefined && peakTotal > maxAngle) {
    warnings.push(
      `Peak swing ${((peakTotal * 180) / Math.PI).toFixed(1)}° exceeds the permitted ` +
        `${((maxAngle * 180) / Math.PI).toFixed(1)}°.`,
    );
  }
  if (peakTotal > 0.35) {
    warnings.push(
      `Peak swing ${((peakTotal * 180) / Math.PI).toFixed(1)}° exceeds ~20°; the small-angle ` +
        'approximation is degraded and the reaction estimate is conservative.',
    );
  }

  return {
    history: hist,
    peakPitchRad: peakPitch,
    peakSwayRad: peakSway,
    peakTotalAngleRad: peakTotal,
    peakDisplacementM: peakDisp,
    naturalPeriodS: naturalPeriod,
    settlingTimeS,
    peakAttachmentReactionN: peakReaction,
    minGroundClearanceM: Number.isFinite(minClearance) ? minClearance : null,
    assumptions: ASSUMPTIONS,
    warnings,
  };
}
