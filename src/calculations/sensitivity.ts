/**
 * Uncertainty and sensitivity analysis — Milestone 12.
 *
 * Operates on any deterministic scalar response R = f(params). Provides
 * one-at-a-time sensitivity, tornado ordering, worst-case combination, and
 * parameter sweeps over low/nominal/high values.
 *
 * Governance: probabilistic conclusions are never presented without the
 * underlying values — every result carries the low/nominal/high inputs and the
 * responses they produced, and nothing is reduced to a single number without
 * the distribution behind it (Rule: uncertainty).
 */

export interface UncertainParameter {
  key: string;
  label: string;
  low: number;
  nominal: number;
  high: number;
}

/** Evaluates the response for a given set of parameter values. */
export type ResponseFn = (values: Record<string, number>) => number;

function nominalValues(params: UncertainParameter[]): Record<string, number> {
  const v: Record<string, number> = {};
  for (const p of params) v[p.key] = p.nominal;
  return v;
}

export interface OneAtATimeEntry {
  key: string;
  label: string;
  responseLow: number;
  responseHigh: number;
  responseNominal: number;
  /** Half-range of the response as this parameter spans low→high, |Rhi−Rlo|/2. */
  swing: number;
  /** Signed slope sign: +1 if response rises with the parameter, −1 if falls. */
  direction: 1 | -1 | 0;
}

export interface SensitivityResult {
  nominalResponse: number;
  /** One-at-a-time entries, sorted by descending swing (tornado order). */
  tornado: OneAtATimeEntry[];
  /** Worst-case (maximum) response from combining each parameter's worse end. */
  worstCaseMaxResponse: number;
  worstCaseMaxValues: Record<string, number>;
  /** Best-case (minimum) response from combining each parameter's better end. */
  bestCaseMinResponse: number;
  bestCaseMinValues: Record<string, number>;
  warnings: string[];
}

/**
 * One-at-a-time sensitivity with tornado ordering and worst/best-case
 * combinations. Each parameter is swept low→high with the others at nominal.
 */
export function analyzeSensitivity(
  params: UncertainParameter[],
  response: ResponseFn,
): SensitivityResult {
  const warnings: string[] = [];
  if (params.length === 0) {
    return {
      nominalResponse: NaN,
      tornado: [],
      worstCaseMaxResponse: NaN,
      worstCaseMaxValues: {},
      bestCaseMinResponse: NaN,
      bestCaseMinValues: {},
      warnings: ['No uncertain parameters supplied.'],
    };
  }
  for (const p of params) {
    if (!(p.low <= p.nominal && p.nominal <= p.high)) {
      warnings.push(`Parameter "${p.key}" nominal ${p.nominal} is not within [${p.low}, ${p.high}].`);
    }
  }

  const nominal = nominalValues(params);
  const nominalResponse = response(nominal);

  const tornado: OneAtATimeEntry[] = params.map((p) => {
    const lowVals = { ...nominal, [p.key]: p.low };
    const highVals = { ...nominal, [p.key]: p.high };
    const rLow = response(lowVals);
    const rHigh = response(highVals);
    const direction: 1 | -1 | 0 = rHigh > rLow ? 1 : rHigh < rLow ? -1 : 0;
    return {
      key: p.key,
      label: p.label,
      responseLow: rLow,
      responseHigh: rHigh,
      responseNominal: nominalResponse,
      swing: Math.abs(rHigh - rLow) / 2,
      direction,
    };
  });
  tornado.sort((a, b) => b.swing - a.swing);

  // Worst-case (max) combination: each parameter set to the end that raises R.
  const worstValues: Record<string, number> = {};
  const bestValues: Record<string, number> = {};
  for (const p of params) {
    const entry = tornado.find((e) => e.key === p.key)!;
    if (entry.direction >= 0) {
      worstValues[p.key] = p.high;
      bestValues[p.key] = p.low;
    } else {
      worstValues[p.key] = p.low;
      bestValues[p.key] = p.high;
    }
  }

  return {
    nominalResponse,
    tornado,
    worstCaseMaxResponse: response(worstValues),
    worstCaseMaxValues: worstValues,
    bestCaseMinResponse: response(bestValues),
    bestCaseMinValues: bestValues,
    warnings,
  };
}

export interface SweepPoint {
  value: number;
  response: number;
}

/** Sweeps one parameter across n points with the others at nominal. */
export function parameterSweep(
  params: UncertainParameter[],
  key: string,
  response: ResponseFn,
  points = 11,
): SweepPoint[] {
  const target = params.find((p) => p.key === key);
  if (!target) throw new Error(`Unknown sweep parameter "${key}".`);
  if (points < 2) throw new Error('A sweep needs at least two points.');
  const nominal = nominalValues(params);
  const out: SweepPoint[] = [];
  for (let i = 0; i < points; i++) {
    const value = target.low + (i / (points - 1)) * (target.high - target.low);
    out.push({ value, response: response({ ...nominal, [key]: value }) });
  }
  return out;
}

/**
 * Estimates the probability that the response exceeds a limit, using the
 * low/nominal/high values of each parameter as a discrete 3-point distribution
 * (weights 0.25 / 0.5 / 0.25) and enumerating the full grid.
 *
 * The full distribution (every combination's response) is returned so the
 * probability is never presented without the values behind it.
 */
export interface ExceedanceResult {
  limit: number;
  probabilityExceed: number;
  combinationsEvaluated: number;
  /** All (weight, response) pairs, sorted by response. */
  distribution: { response: number; weight: number }[];
  warnings: string[];
}

export function probabilityOfExceedance(
  params: UncertainParameter[],
  response: ResponseFn,
  limit: number,
): ExceedanceResult {
  const warnings: string[] = [];
  if (params.length > 12) {
    warnings.push(
      `Enumerating a 3-point grid over ${params.length} parameters is ${3 ** params.length} ` +
        'combinations; reduce the parameter set or use a sampling method.',
    );
  }
  const weightFor = (idx: 0 | 1 | 2) => (idx === 1 ? 0.5 : 0.25);
  const ends: [number, number, number][] = params.map((p) => [p.low, p.nominal, p.high]);

  const distribution: { response: number; weight: number }[] = [];
  let exceedWeight = 0;
  let totalWeight = 0;

  const n = params.length;
  const total = 3 ** n;
  if (total > 1_000_000) {
    return {
      limit,
      probabilityExceed: NaN,
      combinationsEvaluated: 0,
      distribution: [],
      warnings: [...warnings, 'Too many combinations to enumerate; aborted.'],
    };
  }

  for (let combo = 0; combo < total; combo++) {
    const values: Record<string, number> = {};
    let weight = 1;
    let c = combo;
    for (let i = 0; i < n; i++) {
      const idx = (c % 3) as 0 | 1 | 2;
      c = Math.floor(c / 3);
      values[params[i].key] = ends[i][idx];
      weight *= weightFor(idx);
    }
    const r = response(values);
    distribution.push({ response: r, weight });
    totalWeight += weight;
    if (r > limit) exceedWeight += weight;
  }

  distribution.sort((a, b) => a.response - b.response);
  return {
    limit,
    probabilityExceed: totalWeight > 0 ? exceedWeight / totalWeight : NaN,
    combinationsEvaluated: total,
    distribution,
    warnings,
  };
}
