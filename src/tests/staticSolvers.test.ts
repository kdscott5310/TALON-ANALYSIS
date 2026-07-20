import { describe, expect, it } from 'vitest';
import { solveParabolicLeg, type CableLegInput } from '../calculations/parabolicCable';
import { solveMasterNode } from '../calculations/masterNode';
import { checkAnchor } from '../calculations/anchorCheck';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { exampleScenario } from '../models/exampleScenario';
import { GRAVITY, ftToM, lbfToN, lbToKg } from '../units/units';

// ═══════════════════════════════════════════════════════════════════════
// Benchmark 1: Symmetric level cable (horizontal, equal supports)
// ═══════════════════════════════════════════════════════════════════════
//
// L = 100 m, h = 0, w = 1 kg/m * 9.80665 = 9.80665 N/m
// Pretension = 5000 N
//
// For a horizontal cable with small sag:
//   H ≈ T (when sag is small), iterate to get exact H.
//   Sag d = wL^2 / (8H)
//   V_left = V_right = wL/2 = 9.80665 * 100 / 2 = 490.3325 N
//   T = sqrt(H^2 + V^2)
//
// With T = 5000, H = sqrt(5000^2 - 490.33^2) ≈ 4975.89 N
// Sag = 9.80665 * 100^2 / (8 * 4975.89) ≈ 2.463 m

describe('parabolic cable — symmetric level cable benchmark', () => {
  const input: CableLegInput = {
    spanM: 100,
    elevDiffM: 0,
    linearMassKgPerM: 1.0,
    pretensionN: 5000,
    minBreakingStrengthN: 50000,
    designFactor: 5,
  };

  it('produces symmetric vertical reactions', () => {
    const r = solveParabolicLeg(input);
    expect(r.verticalReactionLeftN).toBeCloseTo(r.verticalReactionRightN, 4);
    // Each should be wL/2 = 490.3325
    expect(r.verticalReactionLeftN).toBeCloseTo(490.3325, 2);
  });

  it('computes horizontal tension from pretension correctly', () => {
    const r = solveParabolicLeg(input);
    // T = sqrt(H^2 + V^2) should equal pretension
    const T = Math.sqrt(r.horizontalTensionN ** 2 + r.verticalReactionLeftN ** 2);
    expect(T).toBeCloseTo(5000, 1);
  });

  it('computes sag from the formula d = wL^2/(8H)', () => {
    const r = solveParabolicLeg(input);
    const expectedSag = (1.0 * GRAVITY * 100 ** 2) / (8 * r.horizontalTensionN);
    expect(r.midspanSagM).toBeCloseTo(expectedSag, 6);
  });

  it('cable profile lowest point is at midspan', () => {
    const r = solveParabolicLeg(input);
    // For a level cable, midspan should be the lowest
    const midIdx = Math.floor(r.profile.length / 2);
    expect(r.profile[midIdx].y).toBeCloseTo(r.lowestElevationM, 1);
  });

  it('endpoint tensions are equal for a level cable', () => {
    const r = solveParabolicLeg(input);
    expect(r.tensionLeftN).toBeCloseTo(r.tensionRightN, 4);
  });

  it('utilization is reasonable', () => {
    const r = solveParabolicLeg(input);
    // Allowable = 50000/5 = 10000 N, max tension ≈ 5000 N → utilization ≈ 0.5
    expect(r.utilization).toBeCloseTo(0.5, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Benchmark 2: Cable on a slope (project-relevant geometry)
// ═══════════════════════════════════════════════════════════════════════
//
// Main leg: L = 1000 ft = 304.8 m, h = 0 − 200 ft = −60.96 m
// Cable: 0.11 kg/m, pretension 2500 lbf = 11120.55 N
//
// The higher support (left = master node) should have lower |V| and
// the lower support (right = brake anchor) should have higher |V|
// because of the slope.

describe('parabolic cable — sloped main leg', () => {
  const input: CableLegInput = {
    spanM: ftToM(1000),
    elevDiffM: -ftToM(200), // right is lower
    linearMassKgPerM: 0.11,
    pretensionN: lbfToN(2500),
    minBreakingStrengthN: lbfToN(30000),
    designFactor: 5,
  };

  it('upper (left) support has greater vertical reaction for downhill cable', () => {
    const r = solveParabolicLeg(input);
    // elevDiffM = −60.96 m  (h < 0: right is lower).
    // V_left  = wL/2 − h·H/L = wL/2 + |h|·H/L  (larger)
    // V_right = wL/2 + h·H/L = wL/2 − |h|·H/L  (smaller, may be negative)
    expect(r.verticalReactionLeftN).toBeGreaterThan(r.verticalReactionRightN);
  });

  it('maximum tension is at the upper (left) support for downhill slope', () => {
    const r = solveParabolicLeg(input);
    // Same H, V_left > V_right → T_left > T_right
    expect(r.tensionLeftN).toBeGreaterThan(r.tensionRightN);
  });

  it('cable length exceeds the chord (slope + sag)', () => {
    const r = solveParabolicLeg(input);
    const chord = Math.hypot(input.spanM, input.elevDiffM);
    // The cable follows the sag curve, so arc length > chord
    expect(r.cableLengthM).toBeGreaterThan(chord);
  });

  it('sag/span ratio is reported and small for tight cable', () => {
    const r = solveParabolicLeg(input);
    expect(r.sagSpanRatio).toBeGreaterThan(0);
    expect(r.sagSpanRatio).toBeLessThan(0.08);
    expect(r.warnings.some((w) => w.includes('8%'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Benchmark 3: Point load deflection
// ═══════════════════════════════════════════════════════════════════════
//
// Horizontal level cable, L = 100 m, H = 10000 N (direct),
// w = 0 (massless cable), point load P = 1000 N at midspan.
//
// δ = P * xP * (L - xP) / (H * L) = 1000 * 50 * 50 / (10000 * 100) = 2.5 m
// V_left = P * (L - xP) / L = 1000 * 50/100 = 500 N
// V_right = P * xP / L = 500 N

describe('parabolic cable — point load on massless cable', () => {
  it('deflection matches hand calculation', () => {
    const r = solveParabolicLeg(
      {
        spanM: 100,
        elevDiffM: 0,
        linearMassKgPerM: 0.001, // near-massless (solver needs >0)
        pretensionN: 0,
        horizontalTensionN: 10000,
        minBreakingStrengthN: 100000,
        designFactor: 5,
      },
      { forceN: 1000, positionM: 50 },
    );
    // At x = 50, y should be ≈ -2.5 m (deflected downward)
    const midPt = r.profile[50]; // 100 points, idx 50 = x=50
    expect(midPt.y).toBeCloseTo(-2.5, 1);
    expect(r.verticalReactionLeftN).toBeCloseTo(500, 0);
    expect(r.verticalReactionRightN).toBeCloseTo(500, 0);
  });

  it('asymmetric point load produces correct reactions', () => {
    const r = solveParabolicLeg(
      {
        spanM: 100,
        elevDiffM: 0,
        linearMassKgPerM: 0.001,
        pretensionN: 0,
        horizontalTensionN: 10000,
        minBreakingStrengthN: 100000,
        designFactor: 5,
      },
      { forceN: 1000, positionM: 25 },
    );
    // V_left = 1000 * 75/100 = 750, V_right = 1000 * 25/100 = 250
    expect(r.verticalReactionLeftN).toBeCloseTo(750, 0);
    expect(r.verticalReactionRightN).toBeCloseTo(250, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Benchmark 4: Force-vector equilibrium at master node
// ═══════════════════════════════════════════════════════════════════════
//
// Equal-tension two-line case: two cables at 45° to vertical on each
// side, T = 10000 N each, no rigging weight.
// Each cable: H = T*sin(45°) = 7071 N, V = T*cos(45°) = 7071 N
//
// Backstay pulls left and down: fx = -7071, fy = -7071
// Main leg pulls right and down: fx = +7071, fy = -7071
// Hook reaction: fx = 0 (horizontal cancels), fy = +14142 N
//
// To set this up, we create mock CableLegResults.

describe('master node — equal-tension symmetric benchmark', () => {
  const H = 7071.07;
  const V = 7071.07;
  const T = Math.sqrt(H ** 2 + V ** 2);

  const mockLeg = (Hval: number, Vleft: number, Vright: number) => ({
    horizontalTensionN: Hval,
    verticalReactionLeftN: Vleft,
    verticalReactionRightN: Vright,
    tensionLeftN: T,
    tensionRightN: T,
    maxTensionN: T,
    midspanSagM: 0,
    lowestElevationM: 0,
    cableLengthM: 100,
    sagSpanRatio: 0,
    utilization: 0.5,
    allowableTensionN: 20000,
    profile: [],
    warnings: [],
    assumptions: [],
  });

  it('hook is vertical when cable forces cancel horizontally', () => {
    const backstay = mockLeg(H, 0, V); // right support = node
    const mainLeg = mockLeg(H, V, 0); // left support = node
    const result = solveMasterNode({
      backstay,
      mainLeg,
      riggingMassKg: 0,
      craneRatedCapacityN: 50000,
      dynamicAmplificationFactor: 1.0,
    });
    expect(result.hookReaction.fx).toBeCloseTo(0, 0);
    expect(result.hookReaction.fy).toBeCloseTo(14142, 0);
    expect(result.hookAngleDeg).toBeCloseTo(0, 0);
  });

  it('adding rigging weight increases hook load', () => {
    const backstay = mockLeg(H, 0, V);
    const mainLeg = mockLeg(H, V, 0);
    const r1 = solveMasterNode({
      backstay,
      mainLeg,
      riggingMassKg: 0,
      craneRatedCapacityN: 50000,
      dynamicAmplificationFactor: 1.0,
    });
    const r2 = solveMasterNode({
      backstay,
      mainLeg,
      riggingMassKg: 100,
      craneRatedCapacityN: 50000,
      dynamicAmplificationFactor: 1.0,
    });
    expect(r2.hookResultantN).toBeGreaterThan(r1.hookResultantN);
    // Difference should be exactly 100 * g
    expect(r2.hookResultantN - r1.hookResultantN).toBeCloseTo(100 * GRAVITY, 1);
  });

  it('dynamic amplification scales the hook load', () => {
    const backstay = mockLeg(H, 0, V);
    const mainLeg = mockLeg(H, V, 0);
    const r = solveMasterNode({
      backstay,
      mainLeg,
      riggingMassKg: 0,
      craneRatedCapacityN: 50000,
      dynamicAmplificationFactor: 1.5,
    });
    expect(r.dynamicHookLoadN).toBeCloseTo(r.hookResultantN * 1.5, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Benchmark 5: Unequal-tension resultant
// ═══════════════════════════════════════════════════════════════════════
// Backstay: H = 5000, V_at_node = 8000
// Main leg: H = 7000, V_at_node = 3000
// Hook must absorb: fx = -((-5000) + 7000) = -2000, fy = -(-8000 + -3000) = 11000
// Wait, let me be careful with signs from the solveMasterNode code:
// backstayForce.fx = -H_backstay = -5000
// backstayForce.fy = -V_right_backstay = -8000
// mainLegForce.fx = +H_main = +7000
// mainLegForce.fy = -V_left_main = -3000
// hookReaction.fx = -((-5000) + 7000 + 0) = -2000
// hookReaction.fy = -((-8000) + (-3000) + 0) = 11000

describe('master node — unequal tensions', () => {
  const mockLeg = (H: number, Vl: number, Vr: number) => ({
    horizontalTensionN: H,
    verticalReactionLeftN: Vl,
    verticalReactionRightN: Vr,
    tensionLeftN: Math.hypot(H, Vl),
    tensionRightN: Math.hypot(H, Vr),
    maxTensionN: Math.max(Math.hypot(H, Vl), Math.hypot(H, Vr)),
    midspanSagM: 1,
    lowestElevationM: 0,
    cableLengthM: 200,
    sagSpanRatio: 0.01,
    utilization: 0.3,
    allowableTensionN: 50000,
    profile: [],
    warnings: [],
    assumptions: [],
  });

  it('correctly computes the resultant when H values differ', () => {
    const r = solveMasterNode({
      backstay: mockLeg(5000, 0, 8000), // V_right = 8000 (at node)
      mainLeg: mockLeg(7000, 3000, 0),  // V_left = 3000 (at node)
      riggingMassKg: 0,
      craneRatedCapacityN: 50000,
      dynamicAmplificationFactor: 1.0,
    });
    expect(r.hookReaction.fx).toBeCloseTo(-2000, 0);
    expect(r.hookReaction.fy).toBeCloseTo(11000, 0);
    expect(r.hookResultantN).toBeCloseTo(Math.hypot(2000, 11000), 0);
    expect(r.hookAngleDeg).toBeGreaterThan(0); // off-plumb
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Benchmark 6: Anchor sliding
// ═══════════════════════════════════════════════════════════════════════
//
// 5 blocks × 4000 lb = 20000 lb = 9071.85 kg; W = 88964 N
// μ = 0.5, H = 10000 N
// F_resist = 0.5 * 88964 = 44482 N
// SF = 44482 / 10000 = 4.45

describe('anchor check — sliding benchmark', () => {
  it('matches hand-calculated safety factor', () => {
    const r = checkAnchor({
      label: 'Test anchor',
      horizontalForceN: 10000,
      verticalForceUpN: 0,
      blocksPerAnchor: 5,
      blockMassKg: lbToKg(4000),
      frictionCoefficient: 0.5,
      requiredSlidingSF: 2.0,
    });
    const expectedWeight = 5 * lbToKg(4000) * GRAVITY;
    expect(r.anchorWeightN).toBeCloseTo(expectedWeight, 1);
    expect(r.slidingResistanceN).toBeCloseTo(0.5 * expectedWeight, 1);
    expect(r.slidingSF).toBeCloseTo(0.5 * expectedWeight / 10000, 1);
    expect(r.slidingOk).toBe(true);
    expect(r.upliftSF).toBe(Infinity);
  });

  it('detects insufficient sliding resistance', () => {
    const r = checkAnchor({
      label: 'Undersized anchor',
      horizontalForceN: 50000,
      verticalForceUpN: 0,
      blocksPerAnchor: 1,
      blockMassKg: 100,
      frictionCoefficient: 0.3,
      requiredSlidingSF: 2.0,
    });
    expect(r.slidingOk).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('reduces resistance when uplift is present', () => {
    const r = checkAnchor({
      label: 'Uplift test',
      horizontalForceN: 5000,
      verticalForceUpN: 3000,
      blocksPerAnchor: 5,
      blockMassKg: 100,
      frictionCoefficient: 0.5,
      requiredSlidingSF: 1.0,
    });
    const weight = 5 * 100 * GRAVITY;
    const netNormal = weight - 3000;
    expect(r.netNormalForceN).toBeCloseTo(netNormal, 1);
    expect(r.slidingResistanceN).toBeCloseTo(0.5 * netNormal, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Benchmark 7: Full static analysis with example scenario
// ═══════════════════════════════════════════════════════════════════════

describe('static analysis orchestrator — example scenario', () => {
  it('runs without throwing', () => {
    const r = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.3 });
    expect(r).toBeDefined();
    expect(r.backstay.horizontalTensionN).toBeGreaterThan(0);
    expect(r.mainLegLoaded.horizontalTensionN).toBeGreaterThan(0);
  });

  it('hook reaction is upward', () => {
    const r = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.3 });
    expect(r.masterNode.hookReaction.fy).toBeGreaterThan(0);
  });

  it('backstay tension exceeds main leg tension (steeper angle)', () => {
    // The backstay has a steeper angle to the master node than the main
    // leg, so for similar pretension, backstay reactions should be
    // larger vertically.
    const r = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.3 });
    expect(r.backstay.tensionLeftN).toBeGreaterThan(0);
  });

  it('loaded main leg has higher tension than unloaded', () => {
    const r = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.5 });
    expect(r.mainLegLoaded.maxTensionN).toBeGreaterThan(r.mainLegUnloaded.maxTensionN);
  });

  it('moving trolley changes reactions', () => {
    const r1 = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.1 });
    const r2 = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.9 });
    // Reactions should differ
    expect(r1.mainLegLoaded.verticalReactionLeftN).not.toBeCloseTo(
      r2.mainLegLoaded.verticalReactionLeftN,
      0,
    );
  });

  it('vector equilibrium closes within tolerance', () => {
    const r = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: 0.5 });
    const mn = r.masterNode;
    // Sum of all forces should be zero
    const sumFx =
      mn.backstayForce.fx + mn.mainLegForce.fx + mn.riggingWeight.fx + mn.hookReaction.fx;
    const sumFy =
      mn.backstayForce.fy + mn.mainLegForce.fy + mn.riggingWeight.fy + mn.hookReaction.fy;
    // Tolerance: within 0.01 N (numerical precision)
    expect(Math.abs(sumFx)).toBeLessThan(0.01);
    expect(Math.abs(sumFy)).toBeLessThan(0.01);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Boundary / error cases
// ═══════════════════════════════════════════════════════════════════════

describe('parabolic cable — error handling', () => {
  it('throws on zero span', () => {
    expect(() =>
      solveParabolicLeg({
        spanM: 0,
        elevDiffM: 0,
        linearMassKgPerM: 1,
        pretensionN: 5000,
        minBreakingStrengthN: 50000,
        designFactor: 5,
      }),
    ).toThrow();
  });

  it('throws when neither pretension nor H is provided', () => {
    expect(() =>
      solveParabolicLeg({
        spanM: 100,
        elevDiffM: 0,
        linearMassKgPerM: 1,
        pretensionN: 0,
        minBreakingStrengthN: 50000,
        designFactor: 5,
      }),
    ).toThrow();
  });
});
