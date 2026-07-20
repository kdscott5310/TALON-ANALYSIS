/**
 * Unit conversion module.
 *
 * Internal convention: ALL calculations use SI base units.
 *   length      -> meters (m)
 *   mass        -> kilograms (kg)
 *   force       -> newtons (N)
 *   speed       -> meters/second (m/s)
 *   temperature -> degrees Celsius (deg C)
 *
 * US customary values are converted at the UI boundary only.
 * Conversion factors are exact NIST-defined values where applicable.
 */

// --- exact factors ---
export const FT_PER_M = 3.280839895013123; // 1 m = 1/0.3048 ft
export const M_PER_FT = 0.3048; // exact
export const IN_PER_M = 39.37007874015748;
export const M_PER_IN = 0.0254; // exact
export const LB_PER_KG = 2.2046226218487757;
export const KG_PER_LB = 0.45359237; // exact
export const N_PER_LBF = 4.4482216152605; // exact
export const LBF_PER_N = 1 / N_PER_LBF;
export const MPS_PER_MPH = 0.44704; // exact
export const MPH_PER_MPS = 1 / MPS_PER_MPH;

export const GRAVITY = 9.80665; // m/s^2, standard gravity (exact by definition)

// length
export const ftToM = (ft: number): number => ft * M_PER_FT;
export const mToFt = (m: number): number => m * FT_PER_M;
export const inToM = (inch: number): number => inch * M_PER_IN;
export const mToIn = (m: number): number => m * IN_PER_M;

// mass
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg * LB_PER_KG;

// force
export const lbfToN = (lbf: number): number => lbf * N_PER_LBF;
export const nToLbf = (n: number): number => n * LBF_PER_N;

// speed
export const mphToMps = (mph: number): number => mph * MPS_PER_MPH;
export const mpsToMph = (mps: number): number => mps * MPH_PER_MPS;

// temperature
export const fToC = (f: number): number => ((f - 32) * 5) / 9;
export const cToF = (c: number): number => (c * 9) / 5 + 32;

// area (1 ft² = 0.3048² m², exact)
export const M2_PER_FT2 = M_PER_FT * M_PER_FT;
export const ft2ToM2 = (ft2: number): number => ft2 * M2_PER_FT2;
export const m2ToFt2 = (m2: number): number => m2 / M2_PER_FT2;

// energy (1 ft·lbf = 1 lbf × 1 ft = 4.4482216152605 N × 0.3048 m, exact)
export const J_PER_FTLBF = N_PER_LBF * M_PER_FT;
export const jToFtLbf = (j: number): number => j / J_PER_FTLBF;
export const ftLbfToJ = (ftLbf: number): number => ftLbf * J_PER_FTLBF;

// mass per unit length (cable linear density)
export const lbPerFtToKgPerM = (lbPerFt: number): number =>
  (lbPerFt * KG_PER_LB) / M_PER_FT;
export const kgPerMToLbPerFt = (kgPerM: number): number =>
  kgPerM * M_PER_FT * LB_PER_KG;

export type UnitSystem = 'us' | 'si';

/** Formats a length stored in meters for display in the active unit system. */
export function formatLength(m: number, system: UnitSystem, digits = 1): string {
  return system === 'us'
    ? `${mToFt(m).toFixed(digits)} ft`
    : `${m.toFixed(digits)} m`;
}

/** Formats a force stored in newtons for display in the active unit system. */
export function formatForce(n: number, system: UnitSystem, digits = 0): string {
  return system === 'us'
    ? `${nToLbf(n).toFixed(digits)} lbf`
    : `${n.toFixed(digits)} N`;
}

/** Formats a mass stored in kg for display in the active unit system. */
export function formatMass(kg: number, system: UnitSystem, digits = 1): string {
  return system === 'us'
    ? `${kgToLb(kg).toFixed(digits)} lb`
    : `${kg.toFixed(digits)} kg`;
}

/** Formats a speed stored in m/s for display in the active unit system. */
export function formatSpeed(mps: number, system: UnitSystem, digits = 1): string {
  return system === 'us'
    ? `${mpsToMph(mps).toFixed(digits)} mph`
    : `${mps.toFixed(digits)} m/s`;
}

/** Formats an energy stored in joules for display in the active unit system. */
export function formatEnergy(j: number, system: UnitSystem, digits = 0): string {
  return system === 'us'
    ? `${jToFtLbf(j).toFixed(digits)} ft·lbf`
    : `${(j / 1000).toFixed(Math.max(digits, 1))} kJ`;
}
