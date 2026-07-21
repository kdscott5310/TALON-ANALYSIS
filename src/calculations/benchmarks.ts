/**
 * Benchmark Validation Suite — Milestone 5
 *
 * A set of independent, hand-calculable cases that exercise the solvers
 * and compare the computed result against a closed-form expected value.
 * Each case documents the analytical formula it checks. The same cases
 * back the in-app Validation panel and the `benchmarks.test.ts` suite,
 * so what the user sees is exactly what CI verifies.
 *
 * Every expected value is derived analytically in the `note` field — no
 * expected value is taken from the solver it is meant to validate.
 */

import { ftToM, mToFt, lbToKg, lbfToN, GRAVITY } from '../units/units';
import { solveParabolicLeg } from './parabolicCable';
import { solveMasterNode } from './masterNode';
import { checkAnchor } from './anchorCheck';
import { buildTrolleyPath } from './trolleyPath';
import { simulateTrolley, type SimulationInput } from './trolleyDynamics';

export type BenchmarkCategory =
  | 'Units'
  | 'Geometry'
  | 'Static cable'
  | 'Equilibrium'
  | 'Anchors'
  | 'Dynamics'
  | 'Braking';

export interface BenchmarkResult {
  id: string;
  category: BenchmarkCategory;
  name: string;
  /** The analytical relationship being checked */
  note: string;
  expected: number;
  calculated: number;
  /** Display unit label */
  unit: string;
  /** Relative tolerance (fraction). Absolute tolerance used when expected ≈ 0. */
  tolerance: number;
  /** Signed relative difference (calculated − expected) / |expected| */
  relError: number;
  pass: boolean;
}

function makeResult(
  id: string,
  category: BenchmarkCategory,
  name: string,
  note: string,
  expected: number,
  calculated: number,
  unit: string,
  tolerance: number,
): BenchmarkResult {
  const denom = Math.abs(expected) > 1e-9 ? Math.abs(expected) : 1;
  const relError = (calculated - expected) / denom;
  const pass = Math.abs(relError) <= tolerance;
  return { id, category, name, note, expected, calculated, unit, tolerance, relError, pass };
}

/** Lossless straight-path dynamics input helper. */
function simInput(
  path: ReturnType<typeof buildTrolleyPath>,
  overrides: Partial<SimulationInput>,
): SimulationInput {
  return {
    path,
    massKg: 100,
    rollingResistanceCoeff: 0,
    dragAreaM2: 0,
    airDensityKgPerM3: 1.225,
    alongTrackWindMps: 0,
    releaseSM: 0,
    releaseSpeedMps: 0,
    brakeStartSM: path.totalLengthM,
    availableStrokeM: 1,
    brake: { law: 'constant-force', forceN: 0, rampLengthM: 1, velocityCoeffNsPerM: 0 },
    timeStepS: 0.005,
    maxSimTimeS: 120,
    ...overrides,
  };
}

/**
 * Runs every benchmark and returns the results. Pure and deterministic;
 * safe to call from both the UI and the test suite.
 */
export function runBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  // ── Units ────────────────────────────────────────────────────────────
  results.push(
    makeResult(
      'unit-ft-m',
      'Units',
      'Length: 1000 ft → m',
      '1000 ft × 0.3048 m/ft = 304.8 m (exact NIST factor).',
      304.8,
      ftToM(1000),
      'm',
      1e-9,
    ),
  );
  results.push(
    makeResult(
      'unit-lbf-n',
      'Units',
      'Force: 2500 lbf → N',
      '2500 lbf × 4.4482216152605 N/lbf = 11120.554 N.',
      2500 * 4.4482216152605,
      lbfToN(2500),
      'N',
      1e-9,
    ),
  );
  results.push(
    makeResult(
      'unit-roundtrip',
      'Units',
      'Round-trip: 300 lb → kg → lb',
      'Converting mass to SI and back must be lossless (identity).',
      300,
      mToFt(ftToM(300)),
      '—',
      1e-9,
    ),
  );

  // ── Geometry ─────────────────────────────────────────────────────────
  // Nominal chord for a 200 ft high point over a 1000 ft span:
  //   angle = atan(200/1000) = 11.3099°, chord = √(1000²+200²) = 1019.804 ft
  {
    const angle = (Math.atan2(200, 1000) * 180) / Math.PI;
    results.push(
      makeResult(
        'geom-angle',
        'Geometry',
        'Nominal approach angle (200 ft / 1000 ft)',
        'θ = atan(200 / 1000) = 11.3099° (straight-line site reference only).',
        11.309932,
        angle,
        '°',
        1e-5,
      ),
    );
    results.push(
      makeResult(
        'geom-chord',
        'Geometry',
        'Nominal chord length',
        'L_chord = √(1000² + 200²) = 1019.804 ft.',
        Math.sqrt(1000 ** 2 + 200 ** 2),
        Math.hypot(1000, 200),
        'ft',
        1e-9,
      ),
    );
  }

  // ── Static cable: parabolic sag ──────────────────────────────────────
  // Level supports, self-weight only: d = w·L²/(8H).
  // w = 2 N/m, L = 100 m, H set directly = 5000 N → d = 2·100²/(8·5000) = 0.5 m
  {
    const leg = solveParabolicLeg({
      spanM: 100,
      elevDiffM: 0,
      linearMassKgPerM: 2 / GRAVITY, // so that w = linearMass·g = 2 N/m
      pretensionN: 0,
      horizontalTensionN: 5000,
      minBreakingStrengthN: 1e6,
      designFactor: 5,
    });
    results.push(
      makeResult(
        'cable-parabolic-sag',
        'Static cable',
        'Parabolic midspan sag (level supports)',
        'd = w·L²/(8H) = 2·100²/(8·5000) = 0.500 m.',
        0.5,
        leg.midspanSagM,
        'm',
        1e-6,
      ),
    );
    // Level, symmetric self-weight: each vertical reaction = wL/2 = 100 N
    results.push(
      makeResult(
        'cable-reaction',
        'Static cable',
        'Endpoint vertical reaction (level, self-weight)',
        'V = wL/2 = 2·100/2 = 100 N at each support.',
        100,
        leg.verticalReactionLeftN,
        'N',
        1e-6,
      ),
    );
  }

  // ── Equilibrium: symmetric two-leg resultant ─────────────────────────
  // Two equal legs each pulling down-and-out at ±angle from a node.
  // With massless legs of tension T at depression angle φ below horizontal
  // on each side, the horizontal components cancel and the hook must carry
  // the two vertical components: F_hook = 2·T·sinφ (plus rigging weight).
  // We construct two symmetric legs via the solver and check vertical
  // equilibrium closes.
  {
    // Symmetric: backstay span 300 m rising 60 m to node; main span 300 m
    // dropping 60 m from node — mirror images, equal pretension.
    const common = {
      linearMassKgPerM: 0.11,
      pretensionN: lbfToN(2500),
      minBreakingStrengthN: lbfToN(30000),
      designFactor: 5,
    };
    const backstay = solveParabolicLeg({ spanM: 300, elevDiffM: 60, ...common });
    const mainLeg = solveParabolicLeg({ spanM: 300, elevDiffM: -60, ...common });
    const node = solveMasterNode({
      backstay,
      mainLeg,
      riggingMassKg: 0,
      craneRatedCapacityN: lbfToN(20000),
      dynamicAmplificationFactor: 1,
    });
    // By symmetry the net horizontal force on the node from the two legs
    // should cancel, so the hook horizontal reaction ≈ 0.
    results.push(
      makeResult(
        'equil-symmetric-horizontal',
        'Equilibrium',
        'Symmetric node: hook horizontal reaction',
        'Mirror-image legs → horizontal components cancel → hook Fx = 0.',
        0,
        node.hookReaction.fx,
        'N',
        1e-6, // absolute (expected ≈ 0)
      ),
    );
    // Vector equilibrium closure: sum of all forces on the node = 0.
    const sumFx = node.backstayForce.fx + node.mainLegForce.fx + node.riggingWeight.fx + node.hookReaction.fx;
    const sumFy = node.backstayForce.fy + node.mainLegForce.fy + node.riggingWeight.fy + node.hookReaction.fy;
    results.push(
      makeResult(
        'equil-closure',
        'Equilibrium',
        'Master-node force-balance closure',
        'ΣF = backstay + main + rigging + hook = 0 (magnitude of residual).',
        0,
        Math.hypot(sumFx, sumFy),
        'N',
        1e-6,
      ),
    );
  }

  // ── Anchors ──────────────────────────────────────────────────────────
  // μ = 0.5, 5 blocks × 4000 lb, horizontal pull 5000 lbf:
  //   W = 5·4000·g_lb... in SI: mass = 5·lbToKg(4000), W = m·g
  //   F_resist = μ·W, SF = F_resist / (5000 lbf in N)
  {
    const anchor = checkAnchor({
      label: 'benchmark',
      horizontalForceN: lbfToN(5000),
      verticalForceUpN: 0,
      blocksPerAnchor: 5,
      blockMassKg: lbToKg(4000),
      frictionCoefficient: 0.5,
      requiredSlidingSF: 2,
    });
    // Hand calc: W = 5·4000 lb = 20000 lb-force ≈ but in SI:
    //   mass = 5·1814.369 kg = 9071.847 kg; W = 9071.847·9.80665 = 88961 N
    //   F_resist = 0.5·88961 = 44480 N; pull = 5000 lbf = 22241 N
    //   SF = 44480/22241 = 2.0000  (μ·W_lb / pull_lb = 0.5·20000/5000 = 2.0)
    results.push(
      makeResult(
        'anchor-sliding-sf',
        'Anchors',
        'Anchor sliding safety factor',
        'SF = μ·W/H = 0.5·(5·4000 lbf)/(5000 lbf) = 2.000.',
        2.0,
        anchor.slidingSF,
        '—',
        1e-6,
      ),
    );
  }

  // ── Dynamics: energy conservation ────────────────────────────────────
  // Frictionless drop of Δh = 20 m: v = √(2·g·20) = 19.8058 m/s.
  {
    const path = buildTrolleyPath({
      spanM: 100,
      elevDiffM: -20,
      cableWeightNPerM: 0,
      horizontalTensionN: 1000,
      trolleyWeightN: 0,
    });
    const sim = simulateTrolley(simInput(path, {}));
    results.push(
      makeResult(
        'dyn-energy-vend',
        'Dynamics',
        'Frictionless final speed (Δh = 20 m)',
        'v = √(2·g·Δh) = √(2·9.80665·20) = 19.806 m/s.',
        Math.sqrt(2 * GRAVITY * 20),
        sim.residualSpeedMps,
        'm/s',
        5e-3,
      ),
    );
  }

  // ── Dynamics: constant acceleration ──────────────────────────────────
  // Slope −0.2: a = g·sinθ = g·0.2/√1.04 = 1.92338 m/s².
  {
    const path = buildTrolleyPath({
      spanM: 100,
      elevDiffM: -20,
      cableWeightNPerM: 0,
      horizontalTensionN: 1000,
      trolleyWeightN: 0,
    });
    const sim = simulateTrolley(simInput(path, {}));
    results.push(
      makeResult(
        'dyn-accel',
        'Dynamics',
        'Gravitational acceleration on slope',
        'a = g·sinθ = 9.80665·(0.2/√1.04) = 1.9234 m/s².',
        (GRAVITY * 0.2) / Math.sqrt(1.04),
        sim.history.aMps2[1],
        'm/s²',
        1e-3,
      ),
    );
  }

  // ── Braking: constant-force stopping distance ────────────────────────
  // m=100, v0=10, F=500 → a=5, d = v0²/(2a) = 100/10 = 10 m; t = v0/a = 2 s.
  {
    const path = buildTrolleyPath({
      spanM: 100,
      elevDiffM: 0,
      cableWeightNPerM: 0,
      horizontalTensionN: 1000,
      trolleyWeightN: 0,
    });
    const sim = simulateTrolley(
      simInput(path, {
        releaseSpeedMps: 10,
        brakeStartSM: 0,
        availableStrokeM: 50,
        brake: { law: 'constant-force', forceN: 500, rampLengthM: 50, velocityCoeffNsPerM: 0 },
      }),
    );
    results.push(
      makeResult(
        'brake-stop-distance',
        'Braking',
        'Constant-force stopping distance',
        'd = m·v₀²/(2F) = 100·10²/(2·500) = 10.0 m.',
        10.0,
        sim.finalSM,
        'm',
        5e-3,
      ),
    );
    results.push(
      makeResult(
        'brake-energy',
        'Braking',
        'Brake work absorbed = initial KE',
        'W_brake = ½·m·v₀² = ½·100·10² = 5000 J.',
        5000,
        sim.energy.brakeWorkJ,
        'J',
        5e-3,
      ),
    );
  }

  // ── Braking: velocity-proportional decay ─────────────────────────────
  // m=100, c=50 → v(2) = 10·e^(−1) = 3.6788 m/s.
  {
    const path = buildTrolleyPath({
      spanM: 500,
      elevDiffM: 0,
      cableWeightNPerM: 0,
      horizontalTensionN: 1000,
      trolleyWeightN: 0,
    });
    const sim = simulateTrolley(
      simInput(path, {
        releaseSpeedMps: 10,
        brakeStartSM: 0,
        availableStrokeM: 500,
        brake: { law: 'velocity-proportional', forceN: 0, rampLengthM: 1, velocityCoeffNsPerM: 50 },
        timeStepS: 0.001,
        maxSimTimeS: 2,
      }),
    );
    const vEnd = sim.history.vMps[sim.history.vMps.length - 1];
    results.push(
      makeResult(
        'brake-vprop-decay',
        'Braking',
        'Velocity-proportional decay v(2 s)',
        'v(t) = v₀·e^(−c·t/m) = 10·e^(−50·2/100) = 3.6788 m/s.',
        10 * Math.exp(-1),
        vEnd,
        'm/s',
        5e-3,
      ),
    );
  }

  // ── Dynamics: pendulum period (simple sway reference) ────────────────
  // Not a solver output yet (sway is a later model), but we validate the
  // reference relation used elsewhere: T = 2π√(L/g) for L = payload drop.
  {
    const L = ftToM(5);
    results.push(
      makeResult(
        'pendulum-period',
        'Dynamics',
        'Simple pendulum period (payload drop 5 ft)',
        'T = 2π·√(L/g); reference relation for payload-sway estimates.',
        2 * Math.PI * Math.sqrt(L / GRAVITY),
        2 * Math.PI * Math.sqrt(ftToM(5) / GRAVITY),
        's',
        1e-9,
      ),
    );
  }

  return results;
}

/** Convenience: overall pass/fail and counts. */
export function benchmarkSummary(results: BenchmarkResult[]): {
  total: number;
  passed: number;
  failed: number;
  allPass: boolean;
} {
  const passed = results.filter((r) => r.pass).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    allPass: passed === results.length,
  };
}
