/**
 * Milestone 8B — coupled-dynamics wiring guarantees.
 *
 * The engines are unit-tested elsewhere; these tests pin the properties the UI
 * relies on and reports to the user: zero wheel inertia reduces EXACTLY to the
 * point mass, the effective mass raises the force needed for a given
 * acceleration, the pendulum matches the analytic small-angle period, damping
 * settles the swing (undamped does not), and invalid input fails loudly rather
 * than returning a usable-looking number.
 */
import { describe, it, expect } from 'vitest';
import {
  computeWheelInertia,
  effectiveMass,
  wheelAngularSpeed,
  wheelRotationalEnergy,
} from '../calculations/wheelDynamics';
import { solvePayloadPendulum } from '../calculations/payloadPendulum';
import { GRAVITY } from '../units/units';

describe('wheel inertia — the reduction the panel promises', () => {
  it('zero wheel inertia gives effective mass EXACTLY equal to the point mass', () => {
    const wheels = computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: 0, rollingRadiusM: 0.1 });
    expect(wheels.equivalentRotationalMassKg).toBe(0);
    expect(effectiveMass(900, wheels)).toBe(900);
    expect(effectiveMass(900, null)).toBe(900);
    expect(wheelRotationalEnergy(wheels, 12)).toBe(0);
  });

  it('geometry method matches I = k·m·r² per wheel and raises the effective mass', () => {
    // 4 uniform discs (k=0.5), 8 kg each, r = 0.15 m → I = 4·0.5·8·0.0225 = 0.36 kg·m²
    const wheels = computeWheelInertia({
      kind: 'geometry', wheelCount: 4, wheelMassKg: 8, rollingRadiusM: 0.15, inertiaCoefficient: 0.5,
    });
    expect(wheels.totalRotaryInertiaKgM2).toBeCloseTo(0.36, 10);
    // I/r² = 0.36 / 0.0225 = 16 kg
    expect(wheels.equivalentRotationalMassKg).toBeCloseTo(16, 10);
    const mEff = effectiveMass(900, wheels);
    expect(mEff).toBeCloseTo(916, 10);
    // The same force yields a SMALLER acceleration than the point mass.
    const F = 5000;
    expect(F / mEff).toBeLessThan(F / 900);
  });

  it('reports wheel angular speed from rolling without slip', () => {
    const wheels = computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: 0.36, rollingRadiusM: 0.15 });
    expect(wheelAngularSpeed(wheels, 12)).toBeCloseTo(80, 10); // v/r
  });

  it('fails loudly on invalid input instead of returning a usable number', () => {
    const bad = computeWheelInertia({ kind: 'direct', totalRotaryInertiaKgM2: 1, rollingRadiusM: 0 });
    expect(bad.failureReason).toBeTruthy();
    expect(Number.isNaN(bad.equivalentRotationalMassKg)).toBe(true);
    // A failed wheel result must not silently inflate the mass.
    expect(effectiveMass(900, bad)).toBe(900);
  });
});

describe('payload pendulum — the analytic check the panel shows', () => {
  const quiet = [
    { tS: 0, aAlongTrackMps2: 0 },
    { tS: 30, aAlongTrackMps2: 0 },
  ];

  it('natural period matches T = 2π√(L/g)', () => {
    const L = 4;
    const r = solvePayloadPendulum({
      suspensionLengthM: L, payloadMassKg: 180, dampingRatio: 0,
      initialPitchRad: 0.05, accelerationHistory: quiet,
    });
    expect(r.failureReason).toBeUndefined();
    expect(r.naturalPeriodS).toBeCloseTo(2 * Math.PI * Math.sqrt(L / GRAVITY), 6);
  });

  it('damping settles the swing; an undamped swing does not', () => {
    const base = {
      suspensionLengthM: 4, payloadMassKg: 180, initialPitchRad: 0.2, accelerationHistory: quiet,
    };
    const damped = solvePayloadPendulum({ ...base, dampingRatio: 0.1 });
    const undamped = solvePayloadPendulum({ ...base, dampingRatio: 0 });
    expect(damped.settlingTimeS).not.toBeNull();
    expect(undamped.settlingTimeS).toBeNull(); // reported as never settling, not as 0
  });

  it('a braking pulse drives longitudinal pitch and is deterministic', () => {
    const input = {
      suspensionLengthM: 4, payloadMassKg: 180, dampingRatio: 0.05,
      accelerationHistory: [
        { tS: 0, aAlongTrackMps2: -4 },
        { tS: 2, aAlongTrackMps2: -4 },
        { tS: 2.001, aAlongTrackMps2: 0 },
        { tS: 22, aAlongTrackMps2: 0 },
      ],
    };
    const a = solvePayloadPendulum(input);
    const b = solvePayloadPendulum(input);
    expect(a.peakPitchRad).toBeGreaterThan(0);
    expect(a.peakDisplacementM).toBeGreaterThan(0);
    expect(a.peakAttachmentReactionN).toBeGreaterThan(0);
    expect(a.peakPitchRad).toBe(b.peakPitchRad); // deterministic (Rule 9)
  });

  it('ground clearance is only evaluated when supplied — otherwise null, never 0', () => {
    const noClearance = solvePayloadPendulum({
      suspensionLengthM: 4, payloadMassKg: 180, dampingRatio: 0.05,
      initialPitchRad: 0.2, accelerationHistory: quiet,
    });
    expect(noClearance.minGroundClearanceM).toBeNull();

    const withClearance = solvePayloadPendulum({
      suspensionLengthM: 4, payloadMassKg: 180, dampingRatio: 0.05,
      initialPitchRad: 0.2, accelerationHistory: quiet, restGroundClearanceM: 2,
    });
    // Swinging raises the payload, so clearance grows from the rest value.
    expect(withClearance.minGroundClearanceM).not.toBeNull();
    expect(withClearance.minGroundClearanceM!).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid geometry rather than returning a result', () => {
    const bad = solvePayloadPendulum({
      suspensionLengthM: 0, payloadMassKg: 180, dampingRatio: 0.05, accelerationHistory: quiet,
    });
    expect(bad.failureReason).toBeTruthy();
  });
});
