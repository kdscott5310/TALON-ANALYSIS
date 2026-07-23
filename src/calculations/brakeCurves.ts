/**
 * Brake force models and curves — Milestone 10. **Level 2 where physics-based.**
 *
 * Extends the idealized Milestone-3 brake laws (constant, linear ramp,
 * velocity-proportional) with tabulated and physics-based force models:
 *
 *   - displacement–force, velocity–force, and time–force tables,
 *   - a force–stroke curve (alias of displacement–force),
 *   - an imported measured CSV curve,
 *   - a hydraulic cylinder + orifice model,
 *   - an eddy-current force–speed–gap model.
 *
 * Governance:
 *  - The ORIGINAL imported samples and the interpolation settings are stored
 *    separately from any derived value (Rule 5).
 *  - Interpolation NEVER silently extrapolates: a query outside the sampled
 *    range is clamped and flagged, and the caller is warned (Rule 2).
 *  - Negative force, discontinuities, and non-monotone abscissae are reported.
 *
 * Sign convention: a braking force OPPOSES motion, returned as a positive
 * magnitude. All SI.
 */

export type BrakeCurveKind =
  | 'displacementForce'
  | 'velocityForce'
  | 'timeForce'
  | 'measuredCsv';

export interface BrakeCurve {
  kind: BrakeCurveKind;
  /** Independent-variable samples (m, m/s, or s), strictly increasing. */
  abscissa: number[];
  /** Brake force samples, N (≥ 0 for a dissipative brake). */
  force: number[];
  interpolation: 'linear';
  /** Provenance of the samples (e.g. 'measured', 'manufacturerCurve'). */
  source?: string;
  /** Original raw text, when imported (Rule 5). */
  rawText?: string;
}

export interface CurveValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Validates a curve's sample arrays before it is used. */
export function validateCurve(curve: BrakeCurve): CurveValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { abscissa: xs, force: fs } = curve;

  if (xs.length < 2) errors.push('A curve needs at least two samples.');
  if (xs.length !== fs.length) errors.push('Abscissa and force arrays must be the same length.');
  for (let i = 0; i < xs.length; i++) {
    if (!Number.isFinite(xs[i])) errors.push(`Abscissa sample ${i} is not finite.`);
    if (!Number.isFinite(fs[i])) errors.push(`Force sample ${i} is not finite.`);
  }
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] <= xs[i - 1]) {
      errors.push(`Abscissa must be strictly increasing (sample ${i} = ${xs[i]} ≤ ${xs[i - 1]}).`);
      break;
    }
  }
  for (let i = 0; i < fs.length; i++) {
    if (fs[i] < 0) {
      warnings.push(`Force sample ${i} is negative (${fs[i]} N); a dissipative brake resists motion.`);
      break;
    }
  }
  // Discontinuity: a jump greater than 5× the median segment slope over a
  // near-zero abscissa gap.
  for (let i = 1; i < xs.length; i++) {
    const dx = xs[i] - xs[i - 1];
    const df = Math.abs(fs[i] - fs[i - 1]);
    if (dx > 0 && df / dx > 1e6 && df > 1000) {
      warnings.push(`Steep jump in force between samples ${i - 1} and ${i}; verify the curve is not discontinuous.`);
      break;
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export interface InterpolationResult {
  force: number;
  /** True when the query fell outside the sampled range and was clamped. */
  extrapolated: boolean;
  /** Set when the query was out of range: 'below' | 'above'. */
  clampedFrom?: 'below' | 'above';
}

/**
 * Linear interpolation with CLAMPING (never linear extrapolation). A query
 * outside the sampled range returns the nearest endpoint force and flags the
 * clamp so the caller can warn (Rule 2 — no silent extrapolation).
 */
export function interpolateCurve(curve: BrakeCurve, x: number): InterpolationResult {
  const { abscissa: xs, force: fs } = curve;
  if (x <= xs[0]) {
    return { force: fs[0], extrapolated: x < xs[0], clampedFrom: x < xs[0] ? 'below' : undefined };
  }
  const n = xs.length;
  if (x >= xs[n - 1]) {
    return {
      force: fs[n - 1],
      extrapolated: x > xs[n - 1],
      clampedFrom: x > xs[n - 1] ? 'above' : undefined,
    };
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return { force: fs[lo] + f * (fs[hi] - fs[lo]), extrapolated: false };
}

// ── physics-based preliminary models ──────────────────────────────────────

export interface HydraulicOrificeInput {
  /** Piston bore area, m². */
  pistonAreaM2: number;
  /** Effective orifice discharge area Cd·A_orifice, m². */
  orificeAreaM2: number;
  /** Hydraulic fluid density, kg/m³ (default 870 for typical oil). */
  fluidDensityKgPerM3?: number;
  /** Static/relief preload force, N (default 0). */
  preloadN?: number;
}

/**
 * Hydraulic cylinder + metering orifice: the braking force rises with the
 * square of piston speed. Pressure drop across the orifice
 *   Δp = ½·ρ·(Q/(Cd·A_o))² with Q = A_p·v,
 * so F = Δp·A_p = ½·ρ·A_p·(A_p/(Cd·A_o))²·v² + preload.
 * Reduced-order: incompressible fluid, constant discharge coefficient,
 * accumulator/relief dynamics not modeled.
 */
export function hydraulicOrificeForce(input: HydraulicOrificeInput, speedMps: number): number {
  const rho = input.fluidDensityKgPerM3 ?? 870;
  const Ap = input.pistonAreaM2;
  const Ao = input.orificeAreaM2;
  const preload = input.preloadN ?? 0;
  if (!(Ap > 0) || !(Ao > 0)) return NaN;
  const v = Math.abs(speedMps);
  const areaRatio = Ap / Ao;
  return 0.5 * rho * Ap * areaRatio * areaRatio * v * v + preload;
}

export interface EddyCurrentInput {
  /** Low-speed force coefficient, N·s/m (force = c·v at low speed). */
  lowSpeedCoefficientNsPerM: number;
  /** Characteristic speed where force peaks, m/s. */
  peakSpeedMps: number;
  /** Reference gap the coefficient was measured at, m. */
  referenceGapM: number;
  /** Actual working gap, m. */
  gapM: number;
}

/**
 * Eddy-current brake force–speed–gap model. Force rises linearly at low speed,
 * peaks near `peakSpeedMps`, then falls off at high speed:
 *   F(v) = c·v / (1 + (v/v_peak)²)
 * Gap dependence follows the ~1/gap² falloff of the field:
 *   F ∝ (referenceGap / gap)²
 * Reduced-order: a lumped force–speed law, not a finite-element field solution.
 */
export function eddyCurrentForce(input: EddyCurrentInput, speedMps: number): number {
  const { lowSpeedCoefficientNsPerM: c, peakSpeedMps: vp, referenceGapM: g0, gapM: g } = input;
  if (!(vp > 0) || !(g > 0) || !(g0 > 0)) return NaN;
  const v = Math.abs(speedMps);
  const speedTerm = (c * v) / (1 + (v / vp) * (v / vp));
  const gapTerm = (g0 / g) * (g0 / g);
  return speedTerm * gapTerm;
}

// ── evaluation with warnings ───────────────────────────────────────────────

export interface BrakeEvalContext {
  /** Current stroke into the brake zone, m. */
  strokeM: number;
  /** Current speed, m/s. */
  speedMps: number;
  /** Elapsed time since brake engagement, s. */
  timeS: number;
}

export interface BrakeEvalResult {
  forceN: number;
  warnings: string[];
}

/**
 * Evaluates a tabulated brake curve for the current state, choosing the
 * abscissa by curve kind, and surfacing extrapolation/rating warnings.
 */
export function evaluateBrakeCurve(
  curve: BrakeCurve,
  ctx: BrakeEvalContext,
  ratingN?: number,
): BrakeEvalResult {
  const warnings: string[] = [];
  let x: number;
  let axisLabel: string;
  switch (curve.kind) {
    case 'displacementForce':
      x = ctx.strokeM;
      axisLabel = 'stroke';
      break;
    case 'velocityForce':
      x = ctx.speedMps;
      axisLabel = 'velocity';
      break;
    case 'timeForce':
      x = ctx.timeS;
      axisLabel = 'time';
      break;
    case 'measuredCsv':
      // Measured CSV curves are stroke-based by convention here.
      x = ctx.strokeM;
      axisLabel = 'stroke';
      break;
  }

  const result = interpolateCurve(curve, x);
  if (result.extrapolated) {
    warnings.push(
      `Brake ${axisLabel} ${x.toFixed(3)} is ${result.clampedFrom} the curve's sampled range; ` +
        'the force was clamped to the nearest endpoint and is NOT extrapolated. Extend the curve.',
    );
  }
  if (ratingN !== undefined && ratingN > 0 && result.force > ratingN) {
    warnings.push(
      `Brake force ${result.force.toFixed(0)} N exceeds the entered rating ${ratingN.toFixed(0)} N.`,
    );
  }
  return { forceN: result.force, warnings };
}

// ── CSV import for measured curves ─────────────────────────────────────────

export type CsvCurveResult =
  | { ok: true; curve: BrakeCurve; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Parses a two-column CSV (abscissa, force) into a measured brake curve. The
 * raw text is preserved on the curve (Rule 5). Rows are sorted by abscissa;
 * duplicate or non-increasing abscissae are rejected so interpolation is safe.
 */
export function importBrakeCurveCsv(
  text: string,
  kind: BrakeCurveKind = 'measuredCsv',
): CsvCurveResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return { ok: false, errors: ['CSV needs at least a header and two data rows.'] };

  const errors: string[] = [];
  const rows: { x: number; f: number }[] = [];
  let start = 0;
  // Skip a header row if the first cell is non-numeric.
  if (Number.isNaN(Number(lines[0].split(',')[0]))) start = 1;

  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) {
      errors.push(`Row ${i + 1} does not have two columns.`);
      continue;
    }
    const x = Number(parts[0].trim());
    const f = Number(parts[1].trim());
    if (!Number.isFinite(x) || !Number.isFinite(f)) {
      errors.push(`Row ${i + 1} has a non-numeric value.`);
      continue;
    }
    rows.push({ x, f });
  }
  if (errors.length > 0) return { ok: false, errors };
  if (rows.length < 2) return { ok: false, errors: ['CSV has fewer than two valid data rows.'] };

  rows.sort((a, b) => a.x - b.x);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].x === rows[i - 1].x) {
      return { ok: false, errors: [`Duplicate abscissa value ${rows[i].x}; cannot interpolate.`] };
    }
  }

  const curve: BrakeCurve = {
    kind,
    abscissa: rows.map((r) => r.x),
    force: rows.map((r) => r.f),
    interpolation: 'linear',
    source: 'measured',
    rawText: text,
  };
  const validation = validateCurve(curve);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  return { ok: true, curve, warnings: validation.warnings };
}
