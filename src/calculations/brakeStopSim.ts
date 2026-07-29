/**
 * Reduced-order 1-DOF brake stopping simulation — Milestone 8A. **Level 2.**
 *
 * Integrates the stop of a moving mass at an entry speed under a tabulated brake
 * curve (`brakeCurves.evaluateBrakeCurve`) plus an optional constant resistive
 * force. This is a NEW, additive, self-contained estimator — it does NOT touch
 * the validated v1 CUFTS path-following RK4 solver, and its results never change
 * a v1 result (Rule 1). It is a preliminary 1-DOF stop, not the full trajectory.
 *
 * Governance: brake force is CLAMPED (never extrapolated) by the curve engine
 * and the clamp/rating warnings are surfaced (Rule 2); the run is deterministic
 * (Rule 9); a stop that does not complete within the stroke/time is reported as
 * such, never silently "stopped".
 */
import { interpolateCurve, type BrakeCurve } from './brakeCurves';

export interface BrakeStopInput {
  /** Moving mass (trolley + payload), kg. */
  massKg: number;
  /** Speed at brake engagement, m/s. */
  entrySpeedMps: number;
  curve: BrakeCurve;
  /** Brake-zone stroke available, m. When given, a longer stop is flagged. */
  availableStrokeM?: number;
  /** Brake force rating, N. When given, force above it is flagged. */
  ratingN?: number;
  /** Constant resistive force opposing motion (rolling/drag lump), N. */
  constantResistanceN?: number;
  /** Integration time step, s (default 1 ms). */
  timeStepS?: number;
  /** Safety cap on simulated time, s (default 120). */
  maxTimeS?: number;
}

export interface BrakeStopSample {
  t: number;
  x: number;
  v: number;
  f: number;
}

export interface BrakeStopResult {
  stopped: boolean;
  stoppingDistanceM: number;
  stoppingTimeS: number;
  peakForceN: number;
  peakDecelerationMps2: number;
  brakeEnergyJ: number;
  entryKineticEnergyJ: number;
  /** null when no available stroke was given. */
  withinStroke: boolean | null;
  history: BrakeStopSample[];
  warnings: string[];
  fidelity: 'Level 2 — reduced-order 1-DOF stop';
}

/** Simulates the stop. Deterministic: same inputs → identical result. */
export function simulateBrakeStop(input: BrakeStopInput): BrakeStopResult {
  const m = input.massKg;
  const dt = input.timeStepS ?? 1e-3;
  const maxT = input.maxTimeS ?? 120;
  const resist = input.constantResistanceN ?? 0;

  // Track conditions across the run and summarise them ONCE (not per step), so
  // the warning list is not flooded. Force is read via the low-level
  // interpolateCurve, which clamps (never extrapolates).
  let extrapolatedBelow = false;
  let extrapolatedAbove = false;
  let overRating = false;

  const abscissaFor = (x: number, v: number, t: number): number => {
    switch (input.curve.kind) {
      case 'velocityForce':
        return v;
      case 'timeForce':
        return t;
      default: // displacementForce, measuredCsv → stroke
        return x;
    }
  };

  const brakeForce = (x: number, v: number, t: number): number => {
    const r = interpolateCurve(input.curve, abscissaFor(x, v, t));
    if (r.clampedFrom === 'below') extrapolatedBelow = true;
    if (r.clampedFrom === 'above') extrapolatedAbove = true;
    if (input.ratingN !== undefined && input.ratingN > 0 && r.force > input.ratingN) overRating = true;
    return r.force;
  };

  if (!(m > 0)) {
    return failed('Mass must be positive; the stop cannot be simulated.', input);
  }
  if (!(input.entrySpeedMps > 0)) {
    return failed('Entry speed must be positive; there is nothing to stop.', input);
  }

  let x = 0;
  let v = input.entrySpeedMps;
  let t = 0;
  let peakForce = 0;
  let peakDecel = 0;
  let brakeEnergy = 0;
  const history: BrakeStopSample[] = [];
  const record = () => history.push({ t, x, v, f: brakeForce(x, v, t) });

  // Total resistive force (brake + constant lump) while moving; always ≥ 0.
  const accel = (x_: number, v_: number, t_: number): number => {
    const fb = brakeForce(x_, v_, t_);
    peakForce = Math.max(peakForce, fb);
    const total = fb + (v_ > 0 ? resist : 0);
    return -total / m; // deceleration (negative)
  };

  const sampleEvery = Math.max(1, Math.round((maxT / dt) / 400));
  let step = 0;
  record();

  while (v > 0 && t < maxT) {
    // RK4 on state (x, v) with a = accel(x, v, t).
    const k1x = v;
    const k1v = accel(x, v, t);
    const k2x = v + 0.5 * dt * k1v;
    const k2v = accel(x + 0.5 * dt * k1x, v + 0.5 * dt * k1v, t + 0.5 * dt);
    const k3x = v + 0.5 * dt * k2v;
    const k3v = accel(x + 0.5 * dt * k2x, v + 0.5 * dt * k2v, t + 0.5 * dt);
    const k4x = v + dt * k3v;
    const k4v = accel(x + dt * k3x, v + dt * k3v, t + dt);

    const dx = (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    const dv = (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);

    const fMid = brakeForce(x, v, t);
    peakDecel = Math.max(peakDecel, Math.abs(k1v));
    brakeEnergy += fMid * Math.max(dx, 0); // work done by the brake over the step

    x += dx;
    v += dv;
    t += dt;
    step++;
    if (step % sampleEvery === 0) record();
  }

  const stopped = v <= 0;
  if (stopped && v < 0) v = 0;
  record();

  const withinStroke =
    input.availableStrokeM === undefined ? null : x <= input.availableStrokeM + 1e-9;

  const warnings: string[] = [];
  if (extrapolatedBelow || extrapolatedAbove) {
    const where = [extrapolatedBelow ? 'below' : null, extrapolatedAbove ? 'above' : null]
      .filter(Boolean)
      .join(' and ');
    warnings.push(
      `Brake force was clamped at the curve endpoint where the query fell ${where} the ` +
        'sampled range — it was NOT extrapolated. Extend the curve to cover the full stop.',
    );
  }
  if (overRating) {
    warnings.push(
      `Peak brake force ${peakForce.toFixed(0)} N exceeds the entered rating ` +
        `${input.ratingN!.toFixed(0)} N over part of the stop.`,
    );
  }
  if (!stopped) {
    warnings.push(
      `Did not come to rest within ${maxT.toFixed(0)} s (residual speed ${v.toFixed(2)} m/s). ` +
        'The brake curve may be too weak at low speed, or the mass/entry speed too high.',
    );
  }
  if (withinStroke === false) {
    warnings.push(
      `Stopping distance ${x.toFixed(2)} m exceeds the available stroke ` +
        `${input.availableStrokeM!.toFixed(2)} m — the trolley would overrun the brake zone.`,
    );
  }

  return {
    stopped,
    stoppingDistanceM: x,
    stoppingTimeS: t,
    peakForceN: peakForce,
    peakDecelerationMps2: peakDecel,
    brakeEnergyJ: brakeEnergy,
    entryKineticEnergyJ: 0.5 * m * input.entrySpeedMps * input.entrySpeedMps,
    withinStroke,
    history,
    warnings,
    fidelity: 'Level 2 — reduced-order 1-DOF stop',
  };
}

function failed(message: string, input: BrakeStopInput): BrakeStopResult {
  return {
    stopped: false,
    stoppingDistanceM: 0,
    stoppingTimeS: 0,
    peakForceN: 0,
    peakDecelerationMps2: 0,
    brakeEnergyJ: 0,
    entryKineticEnergyJ: input.massKg > 0 ? 0.5 * input.massKg * input.entrySpeedMps ** 2 : 0,
    withinStroke: null,
    history: [],
    warnings: [message],
    fidelity: 'Level 2 — reduced-order 1-DOF stop',
  };
}
