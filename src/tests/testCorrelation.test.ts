/**
 * Milestone 16 — digital twin / measured-data correlation.
 *
 * Focus: raw data is never mutated; error metrics are correct on known signals;
 * time-shift alignment recovers a known offset; parameter estimation recovers a
 * known parameter from synthetic data; identifiability is flagged.
 */
import { describe, it, expect } from 'vitest';
import {
  conditionChannel,
  correlate,
  estimateParameters,
  movingAverage,
  type EstimableParameter,
  type MeasuredChannel,
  type Signal,
} from '../calculations/testCorrelation';

function ramp(n: number, dt: number, slope: number, shift = 0): Signal {
  const timeS: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    timeS.push(i * dt);
    values.push(slope * (i * dt - shift));
  }
  return { timeS, values };
}

describe('channel conditioning preserves raw data', () => {
  it('applies scale, polarity, and zero without mutating raw', () => {
    const ch: MeasuredChannel = {
      name: 'tension', timeS: [0, 1, 2], raw: [10, 20, 30],
      scaleToSI: 2, polarity: -1, zeroOffset: 5,
    };
    const cond = conditionChannel(ch);
    expect(cond).toEqual([10 * 2 * -1 - 5, 20 * 2 * -1 - 5, 30 * 2 * -1 - 5]);
    // Raw is untouched (Rule: never overwrite raw).
    expect(ch.raw).toEqual([10, 20, 30]);
  });

  it('moving average smooths without changing length or mutating input', () => {
    const input = [0, 10, 0, 10, 0];
    const out = movingAverage(input, 3);
    expect(out).toHaveLength(5);
    expect(input).toEqual([0, 10, 0, 10, 0]); // unchanged
    expect(out[2]).toBeCloseTo((0 + 10 + 10 / 1) / 3, 6); // wait: (10+0+10)/3
  });

  it('rejects an even smoothing window', () => {
    expect(() => movingAverage([1, 2, 3], 2)).toThrow();
  });
});

describe('correlation metrics', () => {
  it('is near-zero error for identical signals', () => {
    const s = ramp(100, 0.01, 5);
    const { metrics } = correlate(s, s);
    expect(metrics.rmse).toBeCloseTo(0, 9);
    expect(metrics.peakError).toBeCloseTo(0, 9);
    expect(metrics.timingErrorS).toBeCloseTo(0, 9);
    expect(metrics.r2).toBeCloseTo(1, 9);
  });

  it('recovers a known time offset and alignment reduces the residual', () => {
    // measured lags the model by 0.1 s.
    const model = ramp(200, 0.01, 5);
    const measured = ramp(200, 0.01, 5, 0.1); // shifted
    const aligned = correlate(model, measured, 0.3, 0.01);
    const unaligned = correlate(model, measured, 0, 0.01); // no shift allowed
    // The recovered shift matches the known −0.1 s offset.
    expect(Math.abs(aligned.metrics.timingErrorS - -0.1)).toBeLessThan(0.02);
    // Alignment cuts the residual by a large factor (only edge-clamping remains).
    expect(aligned.metrics.rmse).toBeLessThan(0.2 * unaligned.metrics.rmse);
  });

  it('reports a peak-value error for a scaled signal', () => {
    const model = ramp(100, 0.01, 6);
    const measured = ramp(100, 0.01, 5);
    const { metrics } = correlate(model, measured, 0.05, 0.01);
    // Model peak exceeds measured peak.
    expect(metrics.peakValueError).toBeGreaterThan(0);
  });

  it('produces a residual signal of the measured length', () => {
    const model = ramp(50, 0.02, 5);
    const measured = ramp(50, 0.02, 4);
    const { residual } = correlate(model, measured);
    expect(residual.values).toHaveLength(50);
  });
});

describe('parameter estimation', () => {
  it('recovers a known slope from synthetic data', () => {
    const trueSlope = 7;
    const measured = ramp(150, 0.01, trueSlope);
    const params: EstimableParameter[] = [
      { key: 'slope', label: 'Slope', min: 0, max: 20, initial: 1 },
    ];
    const predict = (p: Record<string, number>) => ramp(150, 0.01, p.slope);
    const r = estimateParameters(params, predict, measured);
    expect(r.bestParams.slope).toBeCloseTo(trueSlope, 2);
    expect(r.bestRmse).toBeLessThan(0.05);
    expect(r.bestRmse).toBeLessThan(r.initialRmse);
    expect(r.identifiability[0].identifiable).toBe(true);
  });

  it('flags an unidentifiable parameter that does not affect the prediction', () => {
    const measured = ramp(100, 0.01, 5);
    const params: EstimableParameter[] = [
      { key: 'slope', label: 'Slope', min: 0, max: 20, initial: 1 },
      { key: 'ghost', label: 'Ghost (unused)', min: 0, max: 100, initial: 50 },
    ];
    // 'ghost' never enters the prediction.
    const predict = (p: Record<string, number>) => ramp(100, 0.01, p.slope);
    const r = estimateParameters(params, predict, measured);
    expect(r.bestParams.slope).toBeCloseTo(5, 2);
    const ghost = r.identifiability.find((i) => i.key === 'ghost')!;
    expect(ghost.identifiable).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/cannot\s+identify|unconstrained/i);
  });

  it('is deterministic', () => {
    const measured = ramp(100, 0.01, 5);
    const params: EstimableParameter[] = [{ key: 'slope', label: 'S', min: 0, max: 20, initial: 1 }];
    const predict = (p: Record<string, number>) => ramp(100, 0.01, p.slope);
    const a = estimateParameters(params, predict, measured);
    const b = estimateParameters(params, predict, measured);
    expect(a.bestParams.slope).toBe(b.bestParams.slope);
  });
});
