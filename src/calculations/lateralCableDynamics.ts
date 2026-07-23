/**
 * Lateral / out-of-plane cable dynamics — Milestone 11.
 * **Fidelity Level 2 — reduced-order nonlinear dynamics (Rule 11).**
 *
 * The main test line is discretized into a chain of lumped masses connected by
 * the axial cable tension. This solves the transverse (out-of-plane, y) motion
 * governed by the tensioned-string equation with distributed mass, geometric
 * stiffness from the axial tension, structural damping, and distributed wind /
 * gust drag, plus a moving trolley mass and an optional brake impulse.
 *
 *   μ·ÿ_i = T·(y_{i-1} − 2·y_i + y_{i+1})/Δx²·Δx  − c·ẏ_i  + f_wind,i(t) + f_brake,i(t)
 *
 * (interior nodes; the ends are pinned to the supports). The transverse
 * restoring force per node is T·(second difference), the discrete Laplacian of
 * the string. This is the classic lumped-mass string model; its fundamental
 * natural frequency is the analytical benchmark
 *
 *   f₁ = (1 / 2L)·sqrt(T / μ)
 *
 * which `lateralCableDynamics.test.ts` verifies the model reproduces.
 *
 * REDUCED-ORDER SCOPE (labeled everywhere, Rule 11):
 *  - Transverse (out-of-plane) motion only; the axial tension is taken from the
 *    static solution and held constant (small-amplitude assumption). Vertical
 *    and axial coupling is not solved here — that is a fuller multibody / FE
 *    model and is out of scope.
 *  - Linear geometric stiffness (small lateral slope).
 *  - This is NOT a finite-element cable analysis.
 */

export interface LateralCableInput {
  /** Chord length of the span, m (> 0). */
  spanM: number;
  /** Axial tension held during the transverse motion, N (> 0). */
  axialTensionN: number;
  /** Cable mass per unit length, kg/m (> 0). */
  linearMassKgPerM: number;
  /** Structural damping ratio applied to the fundamental mode, dimensionless. */
  dampingRatio: number;
  /** Number of interior lumped masses (≥ 3). More = finer, slower. */
  interiorNodes: number;
  /** Distributed transverse wind pressure force per unit length, N/m (steady). */
  windForcePerLengthNPerM?: number;
  /** Additional gust force per unit length applied as a step at t=0, N/m. */
  gustForcePerLengthNPerM?: number;
  /** Moving trolley mass, kg, added to the nearest node at `trolleyFraction`. */
  trolleyMassKg?: number;
  /** Trolley position as a fraction of the span, 0..1. */
  trolleyFraction?: number;
  /** Lateral brake impulse applied at the trolley node, N·s. */
  brakeImpulseNs?: number;
  /** Simulated duration, s. Default: 6 fundamental periods. */
  durationS?: number;
  /** Integration time step, s. Default: chosen for stability. */
  timeStepS?: number;
}

export interface LateralCableResult {
  /** Fundamental natural frequency of the discretized string, Hz. */
  fundamentalFrequencyHz: number;
  /** Analytical continuous-string fundamental frequency, Hz (benchmark). */
  analyticalFrequencyHz: number;
  /** Peak lateral displacement of any node, m. */
  peakLateralDisplacementM: number;
  /** Static lateral deflection under the steady wind alone, m. */
  staticWindDeflectionM: number;
  /** Dynamic amplification = peak dynamic / static deflection (when wind present). */
  dynamicAmplification: number | null;
  /** Peak out-of-plane reaction at a support, N. */
  peakSupportReactionN: number;
  /** Estimated dominant response frequency from the time history, Hz. */
  dominantFrequencyHz: number;
  /** Time history of the mid-span node lateral displacement, m. */
  midspanHistory: { tS: number[]; yM: number[] };
  /** Peak lateral envelope along the span, m (per node). */
  envelopeM: number[];
  stable: boolean;
  assumptions: string[];
  warnings: string[];
  failureReason?: string;
}

const ASSUMPTIONS = [
  'L1: Transverse (out-of-plane) motion only; axial tension held at its static value.',
  'L2: Linear geometric stiffness (small lateral slope).',
  'L3: Reduced-order lumped-mass string model — NOT finite-element analysis.',
  'L4: Ends pinned to the supports; distributed wind as a uniform transverse load.',
];

export function solveLateralCableDynamics(input: LateralCableInput): LateralCableResult {
  const warnings: string[] = [];
  const fail = (reason: string): LateralCableResult => ({
    fundamentalFrequencyHz: NaN,
    analyticalFrequencyHz: NaN,
    peakLateralDisplacementM: NaN,
    staticWindDeflectionM: NaN,
    dynamicAmplification: null,
    peakSupportReactionN: NaN,
    dominantFrequencyHz: NaN,
    midspanHistory: { tS: [], yM: [] },
    envelopeM: [],
    stable: false,
    assumptions: ASSUMPTIONS,
    warnings: [reason],
    failureReason: reason,
  });

  const { spanM: L, axialTensionN: T, linearMassKgPerM: mu, dampingRatio: zeta } = input;
  if (!(L > 0)) return fail('Span must be a positive, finite number.');
  if (!(T > 0)) return fail('Axial tension must be a positive, finite number.');
  if (!(mu > 0)) return fail('Linear mass must be a positive, finite number.');
  if (!Number.isFinite(zeta) || zeta < 0) return fail('Damping ratio must be finite and ≥ 0.');
  const N = input.interiorNodes;
  if (!Number.isInteger(N) || N < 3) return fail('At least 3 interior nodes are required.');

  const dx = L / (N + 1);
  const nodeMass = mu * dx; // lumped mass per interior node
  const c = Math.sqrt(T / mu); // wave speed
  const analyticalFreq = c / (2 * L); // continuous string fundamental

  // Discrete fundamental frequency of the lumped string:
  // ω₁ = 2·sqrt(T/(μ·Δx²))·sin(π/(2(N+1)))
  const omega1 = 2 * Math.sqrt(T / (mu * dx * dx)) * Math.sin(Math.PI / (2 * (N + 1)));
  const discreteFreq = omega1 / (2 * Math.PI);
  const fundamentalPeriod = 1 / discreteFreq;

  // Stable explicit time step (CFL for the string): dt < dx / c. Use a margin.
  const dtStable = 0.25 * dx / c;
  const dt = Math.min(input.timeStepS ?? dtStable, dtStable);
  const duration = input.durationS ?? 6 * fundamentalPeriod;
  const nSteps = Math.ceil(duration / dt);
  if (nSteps > 5_000_000) return fail('Requested resolution needs too many steps; coarsen the mesh or shorten the run.');

  // Per-node mass (add trolley to the nearest node).
  const mass = new Array<number>(N).fill(nodeMass);
  let trolleyNode = -1;
  if (input.trolleyMassKg && input.trolleyMassKg > 0 && input.trolleyFraction !== undefined) {
    const xTrolley = Math.max(0, Math.min(1, input.trolleyFraction)) * L;
    trolleyNode = Math.max(0, Math.min(N - 1, Math.round(xTrolley / dx) - 1));
    mass[trolleyNode] += input.trolleyMassKg;
  }

  // Distributed transverse force per node, N.
  const windPerLen = input.windForcePerLengthNPerM ?? 0;
  const gustPerLen = input.gustForcePerLengthNPerM ?? 0;
  const forceNode = new Array<number>(N).fill((windPerLen + gustPerLen) * dx);

  // Rayleigh-style damping targeting the fundamental mode: c_node = 2·ζ·ω₁·m.
  const dampPerNode = mass.map((m) => 2 * zeta * omega1 * m);

  // State: y (displacement), v (velocity), pinned ends implied (y=0).
  const y = new Array<number>(N).fill(0);
  const v = new Array<number>(N).fill(0);

  // Optional brake impulse at the trolley node: Δv = J/m at t=0.
  if (input.brakeImpulseNs && trolleyNode >= 0) {
    v[trolleyNode] += input.brakeImpulseNs / mass[trolleyNode];
  }

  const tHist: number[] = [];
  const yMid: number[] = [];
  const envelope = new Array<number>(N).fill(0);
  const midIndex = Math.floor((N - 1) / 2);
  let peakDisp = 0;
  let peakReaction = 0;
  let stable = true;

  const accel = (yy: number[], vv: number[], i: number): number => {
    const left = i === 0 ? 0 : yy[i - 1];
    const right = i === N - 1 ? 0 : yy[i + 1];
    const restoring = (T / dx) * (left - 2 * yy[i] + right); // N
    return (restoring - dampPerNode[i] * vv[i] + forceNode[i]) / mass[i];
  };

  // Velocity-Verlet / semi-implicit Euler (stable for this damped system).
  for (let step = 0; step <= nSteps; step++) {
    const t = step * dt;
    // record
    tHist.push(t);
    yMid.push(y[midIndex]);
    for (let i = 0; i < N; i++) {
      const ay = Math.abs(y[i]);
      if (ay > envelope[i]) envelope[i] = ay;
      if (ay > peakDisp) peakDisp = ay;
    }
    // support reaction ≈ T · slope at the end = T · y[0]/dx (and y[N-1]/dx)
    const reaction = (T / dx) * Math.max(Math.abs(y[0]), Math.abs(y[N - 1]));
    if (reaction > peakReaction) peakReaction = reaction;

    if (!Number.isFinite(y[midIndex]) || peakDisp > 1e6) {
      stable = false;
      warnings.push('Lateral integration became unstable; reduce the time step or node count.');
      break;
    }

    // integrate (semi-implicit: update v then y)
    for (let i = 0; i < N; i++) v[i] += dt * accel(y, v, i);
    for (let i = 0; i < N; i++) y[i] += dt * v[i];
  }

  // Static wind deflection (uniform load on a string): y_mid = q·L²/(8·T).
  const qWind = windPerLen; // steady only, for the amplification reference
  const staticWind = qWind > 0 ? (qWind * L * L) / (8 * T) : 0;
  const dynamicAmplification = staticWind > 0 ? peakDisp / staticWind : null;

  // Dominant frequency: count zero-crossings of the mid-span history.
  const dominant = estimateDominantFrequency(tHist, yMid);

  if (dynamicAmplification !== null && dynamicAmplification > 2.5) {
    warnings.push(
      `Dynamic amplification ${dynamicAmplification.toFixed(1)}× is high; the response is ` +
        'near resonance with the applied loading. Verify damping and gust timing.',
    );
  }
  warnings.push(
    'Reduced-order lateral cable model: transverse motion only, axial tension held ' +
      'static. This is not a finite-element or full multibody result.',
  );

  return {
    fundamentalFrequencyHz: discreteFreq,
    analyticalFrequencyHz: analyticalFreq,
    peakLateralDisplacementM: peakDisp,
    staticWindDeflectionM: staticWind,
    dynamicAmplification,
    peakSupportReactionN: peakReaction,
    dominantFrequencyHz: dominant,
    midspanHistory: { tS: tHist, yM: yMid },
    envelopeM: envelope,
    stable,
    assumptions: ASSUMPTIONS,
    warnings,
  };
}

/** Estimates the dominant frequency from zero-crossings of a mean-removed signal. */
function estimateDominantFrequency(t: number[], y: number[]): number {
  if (t.length < 3) return NaN;
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  let crossings = 0;
  let firstCross = -1;
  let lastCross = -1;
  for (let i = 1; i < y.length; i++) {
    const a = y[i - 1] - mean;
    const b = y[i] - mean;
    if (a === 0 || Math.sign(a) !== Math.sign(b)) {
      crossings++;
      if (firstCross < 0) firstCross = t[i];
      lastCross = t[i];
    }
  }
  if (crossings < 2 || lastCross <= firstCross) return NaN;
  // Two zero-crossings per period.
  const cycles = crossings / 2;
  return cycles / (lastCross - firstCross);
}
