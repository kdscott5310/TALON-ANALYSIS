/**
 * Digital twin — measured-data correlation and parameter estimation — M16.
 *
 * Imports measured test channels, aligns them to the predicted signal,
 * computes residuals and error metrics (RMSE, peak error, timing error,
 * energy comparison), and estimates model parameters to fit the data.
 *
 * Governance:
 *  - RAW measured data is never overwritten (Rule: preserve raw). Every
 *    transform (zero correction, scaling, filtering, alignment) produces a NEW
 *    array; the original samples are retained on the channel.
 *  - Calibration never upgrades results to certified: a calibrated copy is
 *    marked as derived from a specific test and remains preliminary.
 *  - An identifiability warning is raised when a parameter barely affects the
 *    residual (the fit cannot determine it).
 */

export interface MeasuredChannel {
  name: string;
  /** Time stamps, s (monotonic). */
  timeS: number[];
  /** Raw samples — NEVER mutated after import (Rule: preserve raw). */
  raw: number[];
  unit?: string;
  /** Sample rate, Hz, if declared. */
  sampleRateHz?: number;
  /** Polarity: multiply raw by this (+1 or −1) to match the model convention. */
  polarity?: 1 | -1;
  /** Scale factor to convert raw to SI. */
  scaleToSI?: number;
  /** Zero offset subtracted after scaling. */
  zeroOffset?: number;
}

/** Applies scaling, polarity, and zero correction to raw samples (non-destructive). */
export function conditionChannel(ch: MeasuredChannel): number[] {
  const scale = (ch.scaleToSI ?? 1) * (ch.polarity ?? 1);
  const zero = ch.zeroOffset ?? 0;
  return ch.raw.map((v) => v * scale - zero);
}

/** Simple causal moving-average filter (window = odd count). Non-destructive. */
export function movingAverage(values: number[], window: number): number[] {
  if (window < 1 || window % 2 === 0) throw new Error('Window must be a positive odd integer.');
  const half = (window - 1) / 2;
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < values.length) {
        sum += values[j];
        n++;
      }
    }
    out[i] = sum / n;
  }
  return out;
}

/** Linear interpolation of a signal (t, y) at an arbitrary time. */
function interp(t: number[], y: number[], at: number): number {
  if (at <= t[0]) return y[0];
  if (at >= t[t.length - 1]) return y[y.length - 1];
  let lo = 0;
  let hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= at) lo = mid;
    else hi = mid;
  }
  const f = (at - t[lo]) / (t[hi] - t[lo]);
  return y[lo] + f * (y[hi] - y[lo]);
}

export interface Signal {
  timeS: number[];
  values: number[];
}

export interface CorrelationMetrics {
  rmse: number;
  /** Maximum absolute residual, in signal units. */
  peakError: number;
  /** Peak of the predicted signal minus peak of the measured, signal units. */
  peakValueError: number;
  /** Time offset (s) that minimizes RMSE (measured lags model by this). */
  timingErrorS: number;
  /** Trapezoid integral of |predicted| minus |measured| (energy-like). */
  integralError: number;
  /** Coefficient of determination R² of the aligned comparison. */
  r2: number;
  /** Number of comparison points. */
  points: number;
}

/**
 * Compares a predicted signal against a measured one on the measured time
 * base, after finding the best constant time shift within ±maxShiftS.
 */
export function correlate(
  predicted: Signal,
  measured: Signal,
  maxShiftS = 0.5,
  shiftStepS = 0.01,
): { metrics: CorrelationMetrics; residual: Signal; bestShiftS: number } {
  const t = measured.timeS;
  const y = measured.values;

  // Search the shift that minimizes RMSE (measured(t) vs predicted(t+shift)).
  let bestShift = 0;
  let bestRmse = Infinity;
  for (let shift = -maxShiftS; shift <= maxShiftS + 1e-12; shift += shiftStepS) {
    let sse = 0;
    for (let i = 0; i < t.length; i++) {
      const p = interp(predicted.timeS, predicted.values, t[i] + shift);
      sse += (p - y[i]) ** 2;
    }
    const rmse = Math.sqrt(sse / t.length);
    if (rmse < bestRmse) {
      bestRmse = rmse;
      bestShift = shift;
    }
  }

  // Metrics at the best shift.
  const residualVals: number[] = [];
  let peak = 0;
  let sse = 0;
  let sst = 0;
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  let integralPred = 0;
  let integralMeas = 0;
  let predPeak = -Infinity;
  let measPeak = -Infinity;
  for (let i = 0; i < t.length; i++) {
    const p = interp(predicted.timeS, predicted.values, t[i] + bestShift);
    const res = p - y[i];
    residualVals.push(res);
    peak = Math.max(peak, Math.abs(res));
    sse += res * res;
    sst += (y[i] - meanY) ** 2;
    predPeak = Math.max(predPeak, Math.abs(p));
    measPeak = Math.max(measPeak, Math.abs(y[i]));
    if (i > 0) {
      const dt = t[i] - t[i - 1];
      const pPrev = interp(predicted.timeS, predicted.values, t[i - 1] + bestShift);
      integralPred += 0.5 * (Math.abs(p) + Math.abs(pPrev)) * dt;
      integralMeas += 0.5 * (Math.abs(y[i]) + Math.abs(y[i - 1])) * dt;
    }
  }

  const metrics: CorrelationMetrics = {
    rmse: Math.sqrt(sse / t.length),
    peakError: peak,
    peakValueError: predPeak - measPeak,
    timingErrorS: bestShift,
    integralError: integralPred - integralMeas,
    r2: sst > 0 ? 1 - sse / sst : NaN,
    points: t.length,
  };

  return { metrics, residual: { timeS: [...t], values: residualVals }, bestShiftS: bestShift };
}

// ── parameter estimation ────────────────────────────────────────────────────

export interface EstimableParameter {
  key: string;
  label: string;
  min: number;
  max: number;
  initial: number;
}

/** Produces a predicted signal for a candidate parameter set. */
export type PredictFn = (params: Record<string, number>) => Signal;

export interface EstimationResult {
  bestParams: Record<string, number>;
  bestRmse: number;
  initialRmse: number;
  iterations: number;
  /** Per-parameter identifiability: RMSE change when nudged ± across its range. */
  identifiability: { key: string; label: string; rmseSensitivity: number; identifiable: boolean }[];
  warnings: string[];
}

/**
 * Estimates parameters by minimizing correlation RMSE against measured data,
 * using coordinate-descent golden-section search. Reports identifiability so a
 * parameter the data cannot constrain is flagged rather than trusted.
 */
export function estimateParameters(
  params: EstimableParameter[],
  predict: PredictFn,
  measured: Signal,
  options: { maxShiftS?: number; iterations?: number } = {},
): EstimationResult {
  const warnings: string[] = [];
  const maxShiftS = options.maxShiftS ?? 0.3;
  const maxIter = options.iterations ?? 40;
  const GOLDEN = (Math.sqrt(5) - 1) / 2;

  const x: Record<string, number> = {};
  for (const p of params) x[p.key] = p.initial;

  const rmseOf = (xv: Record<string, number>): number =>
    correlate(predict(xv), measured, maxShiftS).metrics.rmse;

  const initialRmse = rmseOf(x);
  let iterations = 0;
  let improved = true;
  while (improved && iterations < maxIter) {
    improved = false;
    iterations++;
    for (const p of params) {
      let a = p.min;
      let b = p.max;
      const f = (t: number) => rmseOf({ ...x, [p.key]: t });
      let c1 = b - GOLDEN * (b - a);
      let c2 = a + GOLDEN * (b - a);
      let f1 = f(c1);
      let f2 = f(c2);
      let guard = 0;
      while (b - a > 1e-6 * (p.max - p.min) && guard++ < 100) {
        if (f1 < f2) { b = c2; c2 = c1; f2 = f1; c1 = b - GOLDEN * (b - a); f1 = f(c1); }
        else { a = c1; c1 = c2; f1 = f2; c2 = a + GOLDEN * (b - a); f2 = f(c2); }
      }
      const best = 0.5 * (a + b);
      if (rmseOf({ ...x, [p.key]: best }) < rmseOf(x) - 1e-12) {
        x[p.key] = best;
        improved = true;
      }
    }
  }

  const bestRmse = rmseOf(x);

  // Identifiability: RMSE change spanning ±10% of the range at the optimum.
  const identifiability = params.map((p) => {
    const span = 0.1 * (p.max - p.min);
    const up = rmseOf({ ...x, [p.key]: Math.min(p.max, x[p.key] + span) });
    const dn = rmseOf({ ...x, [p.key]: Math.max(p.min, x[p.key] - span) });
    const sensitivity = Math.abs(up - bestRmse) + Math.abs(dn - bestRmse);
    const identifiable = sensitivity > 1e-6 * Math.max(bestRmse, 1e-9);
    if (!identifiable) {
      warnings.push(
        `Parameter "${p.label}" barely affects the residual; the test data cannot ` +
          'identify it. Treat its estimate as unconstrained.',
      );
    }
    return { key: p.key, label: p.label, rmseSensitivity: sensitivity, identifiable };
  });

  if (bestRmse >= initialRmse) {
    warnings.push('Estimation did not improve the fit; the model may not represent the data.');
  }

  return { bestParams: { ...x }, bestRmse, initialRmse, iterations, identifiability, warnings };
}
