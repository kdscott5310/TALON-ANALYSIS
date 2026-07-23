/**
 * Milestone 9 — wheel rotational inertia and the damped payload pendulum.
 *
 * Analytical benchmarks:
 *  - zero wheel inertia reduces the effective mass EXACTLY to the point mass,
 *  - m_eff = m + I/r² and a = F/m_eff,
 *  - a uniform disc wheel contributes I = ½·m·r²,
 *  - the small-angle pendulum period is T = 2π·sqrt(L/g),
 *  - a damped free swing decays; an undamped one does not,
 *  - trolley acceleration drives longitudinal pitch; crosswind drives sway.
 */
import { describe, it, expect } from 'vitest';
import {
  computeWheelInertia,
  effectiveMass,
  wheelAngularSpeed,
  wheelRotationalEnergy,
} from '../calculations/wheelDynamics';
import { solvePayloadPendulum, type PendulumTimeSample } from '../calculations/payloadPendulum';
import { GRAVITY } from '../units/units';

describe('wheel rotational inertia', () => {
  it('reduces to the point mass when wheel inertia is zero', () => {
    const wheels = computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: 0, rollingRadiusM: 0.1 });
    expect(wheels.equivalentRotationalMassKg).toBe(0);
    expect(effectiveMass(300, wheels)).toBe(300);
    expect(effectiveMass(300, null)).toBe(300);
    // a = F/m_eff equals the point-mass a = F/m.
    const F = 900;
    expect(F / effectiveMass(300, wheels)).toBeCloseTo(F / 300, 12);
  });

  it('computes m_eff = m + I/r²', () => {
    const wheels = computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: 2, rollingRadiusM: 0.2 });
    // I/r² = 2 / 0.04 = 50 kg.
    expect(wheels.equivalentRotationalMassKg).toBeCloseTo(50, 9);
    expect(effectiveMass(300, wheels)).toBeCloseTo(350, 9);
  });

  it('estimates a uniform-disc wheel as I = ½·m·r² per wheel', () => {
    const wheels = computeWheelInertia({
      kind: 'geometry',
      wheelCount: 4,
      wheelMassKg: 5,
      rollingRadiusM: 0.15,
      inertiaCoefficient: 0.5,
    });
    // I = 4 · 0.5 · 5 · 0.15² = 0.225 kg·m².
    expect(wheels.totalRotaryInertiaKgM2).toBeCloseTo(0.225, 9);
    expect(wheels.inertiaCoefficient).toBe(0.5);
  });

  it('reports rotational energy and wheel speed consistently', () => {
    const wheels = computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: 2, rollingRadiusM: 0.2 });
    // KE_rot = ½·(I/r²)·v² = ½·50·10² = 2500 J.
    expect(wheelRotationalEnergy(wheels, 10)).toBeCloseTo(2500, 6);
    // ω = v/r = 10/0.2 = 50 rad/s.
    expect(wheelAngularSpeed(wheels, 10)).toBeCloseTo(50, 9);
  });

  it('rejects invalid inputs rather than defaulting', () => {
    expect(computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: -1, rollingRadiusM: 0.1 }).failureReason).toBeTruthy();
    expect(computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: 1, rollingRadiusM: 0 }).failureReason).toBeTruthy();
    expect(computeWheelInertia({ kind: 'geometry', wheelCount: 0, wheelMassKg: 5, rollingRadiusM: 0.1, inertiaCoefficient: 0.5 }).failureReason).toBeTruthy();
    expect(() => effectiveMass(0, null)).toThrow();
  });
});

describe('payload pendulum — analytical benchmarks', () => {
  const freeSwing = (over = {}) =>
    solvePayloadPendulum({
      suspensionLengthM: 2,
      payloadMassKg: 100,
      dampingRatio: 0,
      initialPitchRad: 0.05, // ~2.9°, small angle
      accelerationHistory: [],
      timeStepS: 0.001,
      ...over,
    });

  it('has the small-angle natural period T = 2π·sqrt(L/g)', () => {
    const r = freeSwing();
    const expected = 2 * Math.PI * Math.sqrt(2 / GRAVITY);
    expect(r.naturalPeriodS).toBeCloseTo(expected, 9);
  });

  it('a free small-angle swing oscillates at that period (zero crossings)', () => {
    const r = freeSwing();
    // Count sign changes in pitch over the record; period ⇒ 2 crossings/period.
    let crossings = 0;
    for (let i = 1; i < r.history.pitchRad.length; i++) {
      if (Math.sign(r.history.pitchRad[i]) !== Math.sign(r.history.pitchRad[i - 1])) crossings++;
    }
    const simTime = r.history.tS[r.history.tS.length - 1];
    const expectedCrossings = (2 * simTime) / r.naturalPeriodS;
    expect(crossings).toBeGreaterThanOrEqual(Math.floor(expectedCrossings) - 1);
  });

  it('conserves amplitude when undamped and never reports settling', () => {
    const r = freeSwing({ dampingRatio: 0 });
    expect(r.settlingTimeS).toBeNull();
    // Peak stays close to the initial amplitude (energy conserved).
    expect(r.peakPitchRad).toBeCloseTo(0.05, 2);
  });

  it('decays and settles when damped', () => {
    const r = freeSwing({ dampingRatio: 0.1 });
    expect(r.settlingTimeS).not.toBeNull();
    expect(r.settlingTimeS!).toBeGreaterThan(0);
    // Final angle is far below the initial amplitude.
    const finalAngle = Math.abs(r.history.pitchRad[r.history.pitchRad.length - 1]);
    expect(finalAngle).toBeLessThan(0.05 * 0.3);
  });

  it('trolley acceleration drives longitudinal pitch, not lateral sway', () => {
    const accel: PendulumTimeSample[] = [];
    for (let t = 0; t <= 3; t += 0.01) accel.push({ tS: t, aAlongTrackMps2: 2 }); // steady 2 m/s²
    const r = solvePayloadPendulum({
      suspensionLengthM: 3,
      payloadMassKg: 100,
      dampingRatio: 0.05,
      accelerationHistory: accel,
      timeStepS: 0.002,
    });
    expect(r.peakPitchRad).toBeGreaterThan(0.01);
    expect(r.peakSwayRad).toBeLessThan(1e-6); // no wind ⇒ no sway
  });

  it('crosswind drives lateral sway, not longitudinal pitch', () => {
    const r = solvePayloadPendulum({
      suspensionLengthM: 3,
      payloadMassKg: 50,
      dampingRatio: 0.05,
      crosswindMps: 10,
      gustMps: 5,
      payloadDragAreaM2: 0.5,
      accelerationHistory: [],
      timeStepS: 0.002,
    });
    expect(r.peakSwayRad).toBeGreaterThan(0.001);
    expect(r.peakPitchRad).toBeLessThan(1e-6);
  });

  it('a gentle brake produces a bounded swing and reaction', () => {
    // A moderate 2 m/s² (~0.2 g) brake pulse, then release. Static deflection
    // tan θ = a/g ≈ 0.204 (~11.5°); dynamic overshoot stays moderate.
    const accel: PendulumTimeSample[] = [];
    for (let t = 0; t <= 4; t += 0.01) accel.push({ tS: t, aAlongTrackMps2: t < 1 ? -2 : 0 });
    const r = solvePayloadPendulum({
      suspensionLengthM: 1.5,
      payloadMassKg: 120,
      dampingRatio: 0.08,
      accelerationHistory: accel,
      timeStepS: 0.002,
    });
    expect(r.peakPitchRad).toBeGreaterThan(0.05);
    // Reaction is positive and bounded by m·g·tan(peak angle).
    expect(r.peakAttachmentReactionN).toBeGreaterThan(0);
    expect(r.peakAttachmentReactionN).toBeCloseTo(
      120 * GRAVITY * Math.abs(Math.tan(r.peakTotalAngleRad)),
      -1,
    );
  });

  it('a hard brake swings the payload past the small-angle limit and warns', () => {
    // A hard 8 m/s² (~0.8 g) brake drives a large swing; the model must flag
    // that the small-angle approximation is degraded rather than hide it.
    const accel: PendulumTimeSample[] = [];
    for (let t = 0; t <= 4; t += 0.01) accel.push({ tS: t, aAlongTrackMps2: t < 1 ? -8 : 0 });
    const r = solvePayloadPendulum({
      suspensionLengthM: 1.5,
      payloadMassKg: 120,
      dampingRatio: 0.08,
      accelerationHistory: accel,
      timeStepS: 0.002,
      maxPermittedAngleRad: 0.2,
    });
    expect(r.peakTotalAngleRad).toBeGreaterThan(0.35);
    expect(r.warnings.join(' ')).toMatch(/small-angle/i);
    expect(r.warnings.join(' ')).toMatch(/exceeds the permitted/i);
    expect(Number.isFinite(r.peakAttachmentReactionN)).toBe(true);
  });

  it('is deterministic', () => {
    const a = freeSwing({ dampingRatio: 0.1 });
    const b = freeSwing({ dampingRatio: 0.1 });
    expect(a.peakPitchRad).toBe(b.peakPitchRad);
    expect(a.settlingTimeS).toBe(b.settlingTimeS);
  });

  it('rejects invalid inputs rather than defaulting', () => {
    expect(solvePayloadPendulum({ suspensionLengthM: 0, payloadMassKg: 100, dampingRatio: 0, accelerationHistory: [] }).failureReason).toBeTruthy();
    expect(solvePayloadPendulum({ suspensionLengthM: 2, payloadMassKg: -1, dampingRatio: 0, accelerationHistory: [] }).failureReason).toBeTruthy();
    expect(solvePayloadPendulum({ suspensionLengthM: 2, payloadMassKg: 100, dampingRatio: -0.1, accelerationHistory: [] }).failureReason).toBeTruthy();
  });
});
