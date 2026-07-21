/**
 * Dimensional quantity types — Milestone 6.
 *
 * Physical quantities are tagged with their dimension so the compiler rejects
 * dimensionally inconsistent code: a `Quantity<'force'>` cannot be passed
 * where a `Quantity<'length'>` is expected, and arithmetic helpers enforce the
 * dimensional algebra at runtime as well (release gate 3).
 *
 * All values are SI (Rule 8). Conversion happens only at UI/report interfaces.
 * A missing value is `null` — never 0 (Rule 3).
 */

/** Physical dimensions modeled by the platform. */
export type Dimension =
  | 'length'
  | 'area'
  | 'volume'
  | 'mass'
  | 'linearDensity'
  | 'density'
  | 'rotaryInertia'
  | 'time'
  | 'velocity'
  | 'acceleration'
  | 'angle'
  | 'angularVelocity'
  | 'force'
  | 'moment'
  | 'stiffness'
  | 'dampingCoefficient'
  | 'pressure'
  | 'energy'
  | 'power'
  | 'temperature'
  | 'temperatureDelta'
  | 'thermalExpansion'
  | 'frequency'
  | 'dimensionless';

/** The canonical SI unit for each dimension. */
export const SI_UNIT: Record<Dimension, string> = {
  length: 'm',
  area: 'm^2',
  volume: 'm^3',
  mass: 'kg',
  linearDensity: 'kg/m',
  density: 'kg/m^3',
  rotaryInertia: 'kg*m^2',
  time: 's',
  velocity: 'm/s',
  acceleration: 'm/s^2',
  angle: 'rad',
  angularVelocity: 'rad/s',
  force: 'N',
  moment: 'N*m',
  stiffness: 'N/m',
  dampingCoefficient: 'N*s/m',
  pressure: 'Pa',
  energy: 'J',
  power: 'W',
  temperature: 'K',
  temperatureDelta: 'K',
  thermalExpansion: '1/K',
  frequency: 'Hz',
  dimensionless: '1',
};

/**
 * Base-unit exponents (SI: metre, kilogram, second, kelvin) used to verify
 * dimensional algebra at runtime.
 */
export const BASE_EXPONENTS: Record<Dimension, [number, number, number, number]> = {
  //                       m   kg   s    K
  length: [1, 0, 0, 0],
  area: [2, 0, 0, 0],
  volume: [3, 0, 0, 0],
  mass: [0, 1, 0, 0],
  linearDensity: [-1, 1, 0, 0],
  density: [-3, 1, 0, 0],
  rotaryInertia: [2, 1, 0, 0],
  time: [0, 0, 1, 0],
  velocity: [1, 0, -1, 0],
  acceleration: [1, 0, -2, 0],
  angle: [0, 0, 0, 0],
  angularVelocity: [0, 0, -1, 0],
  force: [1, 1, -2, 0],
  moment: [2, 1, -2, 0],
  stiffness: [0, 1, -2, 0],
  dampingCoefficient: [0, 1, -1, 0],
  pressure: [-1, 1, -2, 0],
  energy: [2, 1, -2, 0],
  power: [2, 1, -3, 0],
  temperature: [0, 0, 0, 1],
  temperatureDelta: [0, 0, 0, 1],
  thermalExpansion: [0, 0, 0, -1],
  frequency: [0, 0, -1, 0],
  dimensionless: [0, 0, 0, 0],
};

/** True when two dimensions have identical base-unit exponents. */
export function dimensionsCompatible(a: Dimension, b: Dimension): boolean {
  const ea = BASE_EXPONENTS[a];
  const eb = BASE_EXPONENTS[b];
  return ea[0] === eb[0] && ea[1] === eb[1] && ea[2] === eb[2] && ea[3] === eb[3];
}

/**
 * Finds the dimension produced by multiplying two dimensions, or null when the
 * result is not a modeled dimension (callers must then report rather than
 * silently proceed).
 */
export function productDimension(a: Dimension, b: Dimension): Dimension | null {
  const ea = BASE_EXPONENTS[a];
  const eb = BASE_EXPONENTS[b];
  const target: [number, number, number, number] = [
    ea[0] + eb[0],
    ea[1] + eb[1],
    ea[2] + eb[2],
    ea[3] + eb[3],
  ];
  return findDimension(target);
}

/** Finds the dimension produced by dividing `a` by `b`. */
export function quotientDimension(a: Dimension, b: Dimension): Dimension | null {
  const ea = BASE_EXPONENTS[a];
  const eb = BASE_EXPONENTS[b];
  const target: [number, number, number, number] = [
    ea[0] - eb[0],
    ea[1] - eb[1],
    ea[2] - eb[2],
    ea[3] - eb[3],
  ];
  return findDimension(target);
}

function findDimension(target: [number, number, number, number]): Dimension | null {
  // 'dimensionless' first so a zero exponent vector resolves predictably;
  // 'angle' and 'energy'/'moment' share exponents, so declaration order
  // fixes a deterministic answer (Rule 9).
  const order: Dimension[] = [
    'dimensionless',
    'length',
    'area',
    'volume',
    'mass',
    'linearDensity',
    'density',
    'rotaryInertia',
    'time',
    'velocity',
    'acceleration',
    'angularVelocity',
    'force',
    'energy',
    'stiffness',
    'dampingCoefficient',
    'pressure',
    'power',
    'temperature',
    'thermalExpansion',
  ];
  for (const d of order) {
    const e = BASE_EXPONENTS[d];
    if (e[0] === target[0] && e[1] === target[1] && e[2] === target[2] && e[3] === target[3]) {
      return d;
    }
  }
  return null;
}

/** Convenience aliases used across the model. */
export type Length = 'length';
export type Force = 'force';
export type Mass = 'mass';
export type Velocity = 'velocity';
export type Dimensionless = 'dimensionless';
