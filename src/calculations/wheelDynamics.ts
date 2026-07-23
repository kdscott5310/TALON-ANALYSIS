/**
 * Wheel rotational inertia — Milestone 9.
 *
 * A rolling trolley stores kinetic energy in translation AND in the spinning
 * wheels. Under rolling-without-slip (v = ω·r), the wheels' rotational energy
 * is captured by an EFFECTIVE translational mass:
 *
 *   KE = ½·m·v² + ½·I·ω² = ½·m·v² + ½·I·(v/r)² = ½·(m + I/r²)·v²
 *   ⇒  m_eff = m + I_total/r²
 *
 * A force F then produces a = F / m_eff. With zero wheel inertia this reduces
 * EXACTLY to the point-mass result a = F/m used by the Milestone 3 dynamics,
 * which `wheelDynamics.test.ts` asserts.
 *
 * The wheel inertia may be entered directly, or estimated from geometry with a
 * declared inertia coefficient k (I = k·m_wheel·r² per wheel): k = 0.5 for a
 * uniform disc, ~1.0 for a thin ring/hoop. The coefficient is reported so the
 * estimate is never mistaken for a measured value (Rule 4).
 *
 * All SI. This is a reduced-order model: it assumes rolling without slip and
 * rigid wheels (Rule 11).
 */

export interface WheelInertiaDirectInput {
  kind: 'direct';
  /** Total rotary inertia of all wheels about their axles, kg·m². */
  totalRotaryInertiaKgM2: number;
  /** Effective rolling radius, m. */
  rollingRadiusM: number;
}

export interface WheelInertiaGeometryInput {
  kind: 'geometry';
  wheelCount: number;
  /** Mass of one wheel, kg. */
  wheelMassKg: number;
  /** Rolling radius, m. */
  rollingRadiusM: number;
  /**
   * Inertia coefficient k in I = k·m·r² for one wheel.
   * 0.5 = uniform solid disc, 1.0 = thin ring. Reported with the result.
   */
  inertiaCoefficient: number;
}

export type WheelInertiaInput = WheelInertiaDirectInput | WheelInertiaGeometryInput;

export interface WheelInertiaResult {
  /** Total wheel rotary inertia, kg·m². */
  totalRotaryInertiaKgM2: number;
  rollingRadiusM: number;
  /** I_total / r², the mass-equivalent of the rotating wheels, kg. */
  equivalentRotationalMassKg: number;
  /** How the inertia was obtained, for provenance. */
  method: 'direct' | 'geometry';
  /** Inertia coefficient used (geometry method only). */
  inertiaCoefficient?: number;
  assumptions: string[];
  warnings: string[];
  /** Set when inputs are invalid; the result must not be used. */
  failureReason?: string;
}

const ASSUMPTIONS = [
  'W1: Rolling without slip (v = ω·r).',
  'W2: Rigid wheels; bearing compliance and tyre deflection neglected.',
  'W3: Reduced-order model — not a multibody wheel simulation.',
];

/** Computes the wheel rotary inertia and its mass-equivalent. */
export function computeWheelInertia(input: WheelInertiaInput): WheelInertiaResult {
  const warnings: string[] = [];
  const fail = (reason: string): WheelInertiaResult => ({
    totalRotaryInertiaKgM2: NaN,
    rollingRadiusM: NaN,
    equivalentRotationalMassKg: NaN,
    method: input.kind,
    assumptions: ASSUMPTIONS,
    warnings: [reason],
    failureReason: reason,
  });

  const r = input.rollingRadiusM;
  if (!Number.isFinite(r) || r <= 0) return fail('Rolling radius must be a positive, finite number.');

  let inertia: number;
  let coefficient: number | undefined;
  if (input.kind === 'direct') {
    if (!Number.isFinite(input.totalRotaryInertiaKgM2) || input.totalRotaryInertiaKgM2 < 0) {
      return fail('Total rotary inertia must be finite and ≥ 0.');
    }
    inertia = input.totalRotaryInertiaKgM2;
  } else {
    if (!Number.isInteger(input.wheelCount) || input.wheelCount < 1) {
      return fail('Wheel count must be a positive integer.');
    }
    if (!Number.isFinite(input.wheelMassKg) || input.wheelMassKg < 0) {
      return fail('Wheel mass must be finite and ≥ 0.');
    }
    if (!Number.isFinite(input.inertiaCoefficient) || input.inertiaCoefficient <= 0) {
      return fail('Inertia coefficient must be a positive, finite number.');
    }
    coefficient = input.inertiaCoefficient;
    inertia = input.wheelCount * input.inertiaCoefficient * input.wheelMassKg * r * r;
    if (input.inertiaCoefficient > 1.0) {
      warnings.push(
        `Inertia coefficient ${input.inertiaCoefficient} exceeds 1.0 (a thin ring); ` +
          'verify the wheel mass distribution.',
      );
    }
  }

  const equivalent = inertia / (r * r);

  return {
    totalRotaryInertiaKgM2: inertia,
    rollingRadiusM: r,
    equivalentRotationalMassKg: equivalent,
    method: input.kind,
    inertiaCoefficient: coefficient,
    assumptions: ASSUMPTIONS,
    warnings,
  };
}

/**
 * Effective translational mass of a rolling trolley: the moving mass plus the
 * wheels' rotational mass-equivalent. Returns the moving mass unchanged when
 * the wheel inertia is zero (exact reduction to the point-mass model).
 */
export function effectiveMass(movingMassKg: number, wheels: WheelInertiaResult | null): number {
  if (!Number.isFinite(movingMassKg) || movingMassKg <= 0) {
    throw new Error('Moving mass must be a positive, finite number.');
  }
  if (!wheels || wheels.failureReason) return movingMassKg;
  return movingMassKg + wheels.equivalentRotationalMassKg;
}

/**
 * Rotational kinetic energy stored in the wheels at speed v, J.
 * = ½·(I/r²)·v². Reported separately so energy audits can attribute it.
 */
export function wheelRotationalEnergy(wheels: WheelInertiaResult | null, speedMps: number): number {
  if (!wheels || wheels.failureReason) return 0;
  return 0.5 * wheels.equivalentRotationalMassKg * speedMps * speedMps;
}

/** Wheel angular speed at travel speed v, rad/s (rolling without slip). */
export function wheelAngularSpeed(wheels: WheelInertiaResult | null, speedMps: number): number {
  if (!wheels || wheels.failureReason || wheels.rollingRadiusM <= 0) return 0;
  return speedMps / wheels.rollingRadiusM;
}
