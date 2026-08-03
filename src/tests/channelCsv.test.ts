/**
 * Milestone 8D — measured-channel CSV import & digital-twin wiring.
 *
 * Pins the governance the panel depends on: RAW samples survive conditioning
 * untouched, a blank cell is an error rather than a silent 0, malformed files
 * are rejected with a reason, the synthetic demo is reproducible and clearly
 * example-only, and an unidentifiable parameter is flagged rather than trusted.
 */
import { describe, it, expect } from 'vitest';
import { importChannelCsv, buildSyntheticChannel, syntheticModel } from '../calculations/channelCsv';
import {
  conditionChannel,
  correlate,
  estimateParameters,
  movingAverage,
} from '../calculations/testCorrelation';

const GOOD_CSV = [
  'time_s,cable_tension [N],payload_angle [deg]',
  '0.0,1000,0.0',
  '0.1,1100,0.5',
  '0.2,1250,1.1',
  '0.3,1180,0.7',
].join('\n');

describe('channel CSV import', () => {
  it('parses time, channels, names and units', () => {
    const r = importChannelCsv(GOOD_CSV);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.channels).toHaveLength(2);
    expect(r.channels[0].name).toBe('cable_tension');
    expect(r.channels[0].unit).toBe('N');
    expect(r.channels[1].name).toBe('payload_angle');
    expect(r.channels[1].unit).toBe('deg');
    expect(r.channels[0].raw).toEqual([1000, 1100, 1250, 1180]);
    expect(r.channels[0].timeS).toEqual([0, 0.1, 0.2, 0.3]);
    expect(r.rowCount).toBe(4);
    // The original file text is preserved for traceability (Rule 5).
    expect(r.rawText).toBe(GOOD_CSV);
  });

  it('rejects a blank cell rather than reading it as zero (Rules 3/4)', () => {
    const csv = 'time_s,tension\n0.0,1000\n0.1,\n0.2,1250';
    const r = importChannelCsv(csv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/blank or not a number/i);
  });

  it('rejects non-monotonic time, missing header, and short files with reasons', () => {
    const backwards = importChannelCsv('time_s,x\n0.0,1\n0.2,2\n0.1,3');
    expect(backwards.ok).toBe(false);
    if (!backwards.ok) expect(backwards.errors[0]).toMatch(/strictly increase/i);

    const noHeader = importChannelCsv('0.0,1\n0.1,2\n0.2,3');
    expect(noHeader.ok).toBe(false);
    if (!noHeader.ok) expect(noHeader.errors[0]).toMatch(/header row/i);

    expect(importChannelCsv('time_s,x\n0.0,1').ok).toBe(false);
  });

  it('warns about a sparse sample rate instead of silently trusting it', () => {
    const r = importChannelCsv('time_s,x\n0,1\n1,2\n2,3\n3,4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.join(' ')).toMatch(/sample rate/i);
  });
});

describe('raw preservation (Rule 5)', () => {
  it('conditioning and filtering never mutate the raw samples', () => {
    const r = importChannelCsv(GOOD_CSV);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ch = r.channels[0];
    const rawSnapshot = [...ch.raw];

    const conditioned = conditionChannel({ ...ch, scaleToSI: 2, polarity: -1, zeroOffset: 100 });
    const filtered = movingAverage(conditioned, 3);

    // New arrays, and the raw is byte-for-byte what was imported.
    expect(ch.raw).toEqual(rawSnapshot);
    expect(conditioned).not.toBe(ch.raw);
    expect(filtered).not.toBe(conditioned);
    // Conditioning applied as documented: raw*scale*polarity − zero.
    expect(conditioned[0]).toBe(1000 * 2 * -1 - 100);
  });
});

describe('synthetic demo data (for use BEFORE real test data exists)', () => {
  it('is deterministic and reproducible (Rule 9)', () => {
    const a = buildSyntheticChannel({ seed: 42 });
    const b = buildSyntheticChannel({ seed: 42 });
    expect(a.raw).toEqual(b.raw);
    const c = buildSyntheticChannel({ seed: 43 });
    expect(c.raw).not.toEqual(a.raw);
  });

  it('is labelled example-only by default so it cannot pass as measured data', () => {
    expect(buildSyntheticChannel().name).toMatch(/example only/i);
  });

  it('produces a usable time series at the requested rate', () => {
    const ch = buildSyntheticChannel({ durationS: 4, sampleRateHz: 25 });
    expect(ch.raw.length).toBe(100);
    expect(ch.timeS.length).toBe(100);
    expect(ch.sampleRateHz).toBe(25);
  });
});

describe('correlation & estimation wiring', () => {
  it('a model matching the data correlates near-perfectly', () => {
    const ch = buildSyntheticChannel({ seed: 7, noiseFraction: 0, amplitude: 1, decayRate: 0.35, frequencyHz: 0.5 });
    const measured = { timeS: ch.timeS, values: ch.raw };
    const predicted = syntheticModel({ amplitude: 1, decayRate: 0.35, frequencyHz: 0.5 }, ch.timeS);
    const { metrics } = correlate(predicted, measured, 0.2, 0.01);
    expect(metrics.rmse).toBeLessThan(1e-9);
    expect(metrics.r2).toBeGreaterThan(0.999999);
  });

  it('estimation recovers a known parameter from noise-free data', () => {
    const trueDecay = 0.42;
    const ch = buildSyntheticChannel({ seed: 3, noiseFraction: 0, amplitude: 1, decayRate: trueDecay, frequencyHz: 0.5 });
    const measured = { timeS: ch.timeS, values: ch.raw };
    const result = estimateParameters(
      [{ key: 'decayRate', label: 'Decay rate', min: 0.05, max: 1.5, initial: 0.2 }],
      (p) => syntheticModel({ amplitude: 1, decayRate: p.decayRate, frequencyHz: 0.5 }, ch.timeS),
      measured,
    );
    expect(result.bestParams.decayRate).toBeCloseTo(trueDecay, 2);
    expect(result.bestRmse).toBeLessThan(result.initialRmse);
  });

  it('flags a parameter the data cannot constrain as UNIDENTIFIABLE', () => {
    const ch = buildSyntheticChannel({ seed: 11, noiseFraction: 0 });
    const measured = { timeS: ch.timeS, values: ch.raw };
    const result = estimateParameters(
      [
        { key: 'decayRate', label: 'Decay rate', min: 0.05, max: 1.5, initial: 0.35 },
        // A parameter the prediction ignores entirely — the data says nothing about it.
        { key: 'ghost', label: 'Unused parameter', min: 0, max: 100, initial: 50 },
      ],
      (p) => syntheticModel({ amplitude: 1, decayRate: p.decayRate, frequencyHz: 0.5 }, ch.timeS),
      measured,
    );
    const ghost = result.identifiability.find((i) => i.key === 'ghost')!;
    expect(ghost.identifiable).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/identif/i);
  });
});
