import { describe, expect, it } from 'vitest';
import {
  ftToM, mToFt, inToM, mToIn, lbToKg, kgToLb, lbfToN, nToLbf,
  mphToMps, mpsToMph, fToC, cToF, lbPerFtToKgPerM, kgPerMToLbPerFt,
  formatLength, formatForce, GRAVITY,
} from '../units/units';

// Benchmark hand calculations:
//   1000 ft = 304.8 m (exact, 0.3048 m/ft)
//   200 ft = 60.96 m
//   0.5 in = 0.0127 m
//   300 lb = 136.0777 kg (300 * 0.45359237)
//   2500 lbf = 11120.554 N (2500 * 4.4482216152605)
//   60 mph = 26.8224 m/s (60 * 0.44704)
//   32 F = 0 C; 212 F = 100 C

describe('length conversions', () => {
  it('converts feet to meters exactly', () => {
    expect(ftToM(1000)).toBeCloseTo(304.8, 10);
    expect(ftToM(200)).toBeCloseTo(60.96, 10);
  });
  it('round-trips ft<->m', () => {
    expect(mToFt(ftToM(1234.5))).toBeCloseTo(1234.5, 9);
  });
  it('converts inches to meters exactly', () => {
    expect(inToM(0.5)).toBeCloseTo(0.0127, 12);
    expect(mToIn(inToM(0.625))).toBeCloseTo(0.625, 12);
  });
});

describe('mass conversions', () => {
  it('converts pounds to kilograms exactly', () => {
    expect(lbToKg(300)).toBeCloseTo(136.077711, 6);
  });
  it('round-trips lb<->kg', () => {
    expect(kgToLb(lbToKg(75))).toBeCloseTo(75, 9);
  });
});

describe('force conversions', () => {
  it('converts lbf to newtons exactly', () => {
    expect(lbfToN(2500)).toBeCloseTo(11120.554, 3);
  });
  it('round-trips lbf<->N', () => {
    expect(nToLbf(lbfToN(8600))).toBeCloseTo(8600, 8);
  });
  it('relates lbf to kg via standard gravity', () => {
    // 1 lbf = 0.45359237 kg * 9.80665 m/s^2
    expect(lbfToN(1)).toBeCloseTo(0.45359237 * GRAVITY, 10);
  });
});

describe('speed conversions', () => {
  it('converts mph to m/s exactly', () => {
    expect(mphToMps(60)).toBeCloseTo(26.8224, 10);
  });
  it('round-trips mph<->m/s', () => {
    expect(mpsToMph(mphToMps(65))).toBeCloseTo(65, 9);
  });
});

describe('temperature conversions', () => {
  it('converts known reference points', () => {
    expect(fToC(32)).toBeCloseTo(0, 12);
    expect(fToC(212)).toBeCloseTo(100, 12);
    expect(cToF(-40)).toBeCloseTo(-40, 12);
  });
});

describe('linear-mass conversions', () => {
  it('round-trips lb/ft <-> kg/m', () => {
    expect(kgPerMToLbPerFt(lbPerFtToKgPerM(0.074))).toBeCloseTo(0.074, 9);
  });
  it('matches hand calc: 1 lb/ft = 1.48816 kg/m', () => {
    expect(lbPerFtToKgPerM(1)).toBeCloseTo(1.488164, 5);
  });
});

describe('display formatting', () => {
  it('formats lengths in the selected unit system', () => {
    expect(formatLength(304.8, 'us', 0)).toBe('1000 ft');
    expect(formatLength(304.8, 'si', 1)).toBe('304.8 m');
  });
  it('formats forces in the selected unit system', () => {
    expect(formatForce(lbfToN(2500), 'us', 0)).toBe('2500 lbf');
  });
});
