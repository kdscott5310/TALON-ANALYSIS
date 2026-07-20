/**
 * Trolley Path Builder — Milestone 3
 *
 * Builds the geometric path the trolley follows along the main downhill
 * cable, parameterized by arc length s, for use by the time-step
 * dynamics solver.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * MODEL — trolley influence line on the parabolic cable
 * ═══════════════════════════════════════════════════════════════════════
 * The static cable shape depends on where the trolley is. The path the
 * trolley actually traverses is the "influence line": the elevation of
 * the load point when the trolley (point load P) is AT x.
 *
 * With the Milestone-2 parabolic model (H prescribed by pretension,
 * self-weight w per horizontal meter):
 *
 *   Deflection of the load point when the load is at x:
 *     δ_P(x) = P·x·(L−x)/(H·L)                        (Irvine, point load)
 *
 *   Trolley path elevation (relative to the left/high support):
 *     y_t(x) = (h/L)·x − (w/(2H))·x·(L−x) − (P/(H·L))·x·(L−x)   ... (1)
 *
 *   Analytic slope:
 *     dy_t/dx = h/L − [w/(2H) + P/(H·L)]·(L−2x)                  ... (2)
 *
 * The gravitational driving force in the dynamics solver uses this
 * path gradient (energy-consistent for a quasi-static cable: the work
 * done against gravity equals m·g·Δy_t along the path).
 *
 * ASSUMPTIONS
 *  P1. Cable responds quasi-statically (cable inertia and longitudinal
 *      wave effects neglected).
 *  P2. H is constant at the unloaded pretension value (geometric
 *      stiffening under the moving load neglected — consistent with
 *      the Milestone-2 static model).
 *  P3. The kink under the trolley is smoothed by the wheelbase; the
 *      path gradient of Eq. (2) is used as the effective slope.
 *  P4. Elastic cable stretch, wind and temperature geometry effects
 *      are neglected.
 */

export interface TrolleyPathInput {
  /** Main-leg horizontal span, m */
  spanM: number;
  /** Elevation of right support minus left support, m (negative = downhill) */
  elevDiffM: number;
  /** Distributed cable load per horizontal meter, N/m (= linear mass × g) */
  cableWeightNPerM: number;
  /** Horizontal tension component, N (from the pretension solver) */
  horizontalTensionN: number;
  /** Trolley + payload weight (point load), N */
  trolleyWeightN: number;
  /** Number of sample intervals for arc-length integration (default 800) */
  nSamples?: number;
}

export interface TrolleyPathPoint {
  /** Horizontal position from the left (high) support, m */
  x: number;
  /** Path elevation relative to the left support, m (negative below support) */
  y: number;
  /** Cumulative arc length from x = 0, m */
  s: number;
}

export interface TrolleyPath {
  points: TrolleyPathPoint[];
  totalLengthM: number;
  /** Net elevation change start → end, m (negative = descends) */
  elevChangeM: number;
  /** True if any segment has a locally uphill gradient (dy/dx > 0) */
  hasUphillSegment: boolean;
  warnings: string[];
  assumptions: string[];
  /** Path elevation at arc-length s (m, relative to left support) */
  yAtS(s: number): number;
  /** Horizontal position at arc-length s, m */
  xAtS(s: number): number;
  /** Path slope dy/dx at arc-length s (analytic, Eq. 2) */
  slopeAtS(s: number): number;
  /** Arc length at horizontal position x, m */
  sAtX(x: number): number;
}

/** Path elevation, Eq. (1). Exported for tests. */
export function pathElevation(
  x: number,
  spanM: number,
  elevDiffM: number,
  w: number,
  H: number,
  P: number,
): number {
  return (
    (elevDiffM / spanM) * x -
    (w / (2 * H)) * x * (spanM - x) -
    (P / (H * spanM)) * x * (spanM - x)
  );
}

/** Analytic path slope dy/dx, Eq. (2). Exported for tests. */
export function pathSlope(
  x: number,
  spanM: number,
  elevDiffM: number,
  w: number,
  H: number,
  P: number,
): number {
  return elevDiffM / spanM - (w / (2 * H) + P / (H * spanM)) * (spanM - 2 * x);
}

export function buildTrolleyPath(input: TrolleyPathInput): TrolleyPath {
  const { spanM, elevDiffM, cableWeightNPerM: w, horizontalTensionN: H, trolleyWeightN: P } = input;
  const n = input.nSamples ?? 800;
  const warnings: string[] = [];
  const assumptions = [
    'P1: Cable responds quasi-statically to the moving trolley.',
    'P2: Horizontal tension held at the unloaded pretension value.',
    'P3: Path gradient of the influence line used as effective slope.',
    'P4: Elastic stretch, wind and temperature geometry effects neglected.',
  ];

  if (!(spanM > 0)) throw new Error('Trolley path: span must be positive.');
  if (!(H > 0)) throw new Error('Trolley path: horizontal tension must be positive.');
  if (!(w >= 0)) throw new Error('Trolley path: cable weight must be zero or positive.');
  if (!(P >= 0)) throw new Error('Trolley path: trolley weight must be zero or positive.');
  if (!Number.isFinite(elevDiffM)) throw new Error('Trolley path: elevation difference must be finite.');
  if (!(n >= 10)) throw new Error('Trolley path: at least 10 samples required.');

  const points: TrolleyPathPoint[] = [];
  let s = 0;
  let prevX = 0;
  let prevY = pathElevation(0, spanM, elevDiffM, w, H, P);
  points.push({ x: 0, y: prevY, s: 0 });
  let hasUphillSegment = false;

  for (let i = 1; i <= n; i++) {
    const x = (i / n) * spanM;
    const y = pathElevation(x, spanM, elevDiffM, w, H, P);
    s += Math.hypot(x - prevX, y - prevY);
    points.push({ x, y, s });
    if (y > prevY) hasUphillSegment = true;
    prevX = x;
    prevY = y;
  }

  if (hasUphillSegment) {
    warnings.push(
      'Trolley path has a locally uphill segment (cable sags below the brake anchor). ' +
        'The trolley may decelerate or stall before the brake zone; verify pretension and geometry.',
    );
  }

  const totalLengthM = s;
  const elevChangeM = points[points.length - 1].y - points[0].y;

  /** Binary search: greatest index i with points[i].s <= target. */
  function idxAtS(target: number): number {
    if (target <= 0) return 0;
    if (target >= totalLengthM) return points.length - 2;
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].s <= target) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function xAtS(target: number): number {
    const sc = Math.max(0, Math.min(target, totalLengthM));
    const i = idxAtS(sc);
    const a = points[i];
    const b = points[i + 1];
    const seg = b.s - a.s;
    const f = seg > 0 ? (sc - a.s) / seg : 0;
    return a.x + f * (b.x - a.x);
  }

  function yAtS(target: number): number {
    return pathElevation(xAtS(target), spanM, elevDiffM, w, H, P);
  }

  function slopeAtS(target: number): number {
    return pathSlope(xAtS(target), spanM, elevDiffM, w, H, P);
  }

  function sAtX(x: number): number {
    const xc = Math.max(0, Math.min(x, spanM));
    // points are uniformly spaced in x
    const f = (xc / spanM) * n;
    const i = Math.min(Math.floor(f), n - 1);
    const a = points[i];
    const b = points[i + 1];
    const frac = b.x > a.x ? (xc - a.x) / (b.x - a.x) : 0;
    return a.s + frac * (b.s - a.s);
  }

  return {
    points,
    totalLengthM,
    elevChangeM,
    hasUphillSegment,
    warnings,
    assumptions,
    yAtS,
    xAtS,
    slopeAtS,
    sAtX,
  };
}
