/**
 * Static Analysis Orchestrator — Milestone 2
 *
 * Runs all static solvers for a given Scenario and trolley position,
 * collecting results and warnings.
 */

import type { Scenario } from '../models/scenario';
import { GRAVITY } from '../units/units';
import { computeLayout, type LayoutGeometry } from './layoutGeometry';
import { solveParabolicLeg, type CableLegResult, type PointLoadInput } from './parabolicCable';
import { solveMasterNode, type MasterNodeResult } from './masterNode';
import { checkAnchor, type AnchorCheckResult } from './anchorCheck';

export interface StaticAnalysisInput {
  scenario: Scenario;
  /** Trolley position as fraction of main-leg span (0 = at master node, 1 = at brake anchor). Default 0.3 */
  trolleyPositionFrac: number;
}

export interface StaticAnalysisResult {
  layout: LayoutGeometry;
  backstay: CableLegResult;
  mainLegUnloaded: CableLegResult;
  mainLegLoaded: CableLegResult;
  masterNode: MasterNodeResult;
  launchAnchor: AnchorCheckResult;
  brakeAnchor: AnchorCheckResult;
  /** Ground clearance at lowest cable point minus min-clearance requirement, m */
  groundClearanceMarginM: number;
  /** All warnings, collected and de-duplicated */
  allWarnings: string[];
  /** All assumptions */
  allAssumptions: string[];
}

export function runStaticAnalysis(input: StaticAnalysisInput): StaticAnalysisResult {
  const { scenario, trolleyPositionFrac } = input;
  const { site, cable, trolley, crane, anchors } = scenario;

  const layout = computeLayout(site);

  // ── Backstay ────────────────────────────────────────────────────────
  // Left support = launch anchor (0, 0), right support = master node.
  // elevDiff = masterNode.y - launchAnchor.y = highPointElevation
  const backstay = solveParabolicLeg({
    spanM: site.launchAnchorOffsetM,
    elevDiffM: site.highPointElevationM, // right is higher
    linearMassKgPerM: cable.linearMassKgPerM,
    pretensionN: cable.pretensionN,
    minBreakingStrengthN: cable.minBreakingStrengthN,
    designFactor: cable.designFactor,
  });

  // ── Main leg (unloaded) ─────────────────────────────────────────────
  // Left support = master node (higher), right = brake anchor (lower)
  // elevDiff = brakeAnchor.y - masterNode.y = brakeAnchorElev - highPoint (negative)
  const mainLegElevDiff = site.brakeAnchorElevationM - site.highPointElevationM;

  const mainLegUnloaded = solveParabolicLeg({
    spanM: site.horizontalSpanM,
    elevDiffM: mainLegElevDiff,
    linearMassKgPerM: cable.linearMassKgPerM,
    pretensionN: cable.pretensionN,
    minBreakingStrengthN: cable.minBreakingStrengthN,
    designFactor: cable.designFactor,
  });

  // ── Main leg (loaded with trolley) ──────────────────────────────────
  const totalMovingMassKg = trolley.trolleyMassKg + trolley.testArticleMassKg;
  const trolleyWeightN = totalMovingMassKg * GRAVITY;
  const trolleyXOnMainLeg = trolleyPositionFrac * site.horizontalSpanM;

  const pointLoad: PointLoadInput = {
    forceN: trolleyWeightN,
    positionM: trolleyXOnMainLeg,
  };

  // Use the same pretension (sets H) and then add the point load.
  // The parabolic solver uses the unloaded H for the loaded case
  // (pretension sets the cable; trolley adds deflection).
  const mainLegLoaded = solveParabolicLeg(
    {
      spanM: site.horizontalSpanM,
      elevDiffM: mainLegElevDiff,
      linearMassKgPerM: cable.linearMassKgPerM,
      pretensionN: cable.pretensionN,
      minBreakingStrengthN: cable.minBreakingStrengthN,
      designFactor: cable.designFactor,
    },
    pointLoad,
  );

  // ── Master-node equilibrium ────────────────────────────────────────
  // backstay: we need it oriented so the NODE is the right support
  // (already the case: left = launch, right = node).
  // mainLeg: node is the LEFT support (already the case: left = node,
  // right = brake anchor). Use the LOADED main leg for the loaded condition.
  const masterNode = solveMasterNode({
    backstay,
    mainLeg: mainLegLoaded,
    riggingMassKg: crane.riggingMassKg,
    craneRatedCapacityN: crane.ratedCapacityAtRadiusN,
    dynamicAmplificationFactor: crane.dynamicAmplificationFactor,
  });

  // ── Anchor checks ─────────────────────────────────────────────────
  // Launch anchor: pulled by the backstay. The cable goes up to the
  // master node, so the horizontal pull is H_backstay (toward the node)
  // and the vertical pull is V_left of the backstay (which is the
  // reaction at the launch anchor — but the ANCHOR must resist it,
  // so the pull on the anchor is in the direction of the cable).
  //
  // For the backstay (left = launch, right = node, elevDiff > 0):
  //   V_left = vertical reaction at the launch anchor.
  //   This reaction is upward ON THE CABLE, meaning the cable pulls
  //   the anchor DOWNWARD (into the ground) — unless the cable slope
  //   is steep enough that the vertical component reverses.
  //   Horizontal pull on anchor = H (toward the node, i.e. inward).
  //
  // The cable pulls the launch anchor with force (H, -V_left) where
  // the sign on V depends on orientation. The anchor feels a horizontal
  // pull = H and a vertical pull = V_left if V_left < 0 (uplift), or
  // a downward push if V_left > 0.
  //
  // V_left from parabolic: positive means the cable pulls UP on the
  // left support = upward reaction. So the cable pulls the anchor
  // DOWNWARD (reaction). For sliding, the horizontal force is H.
  // For uplift, the cable pulls upward when V_left is positive
  // (cable hangs below the anchor, pulling it up)... Actually no:
  // V_left is the support reaction upward. That means the support
  // provides an upward force, and by Newton 3 the cable pulls
  // DOWN on the support. So uplift from the cable = 0 when V_left > 0.
  //
  // Wait, let me be careful:
  // In our convention, V_left > 0 means the left support exerts an
  // UPWARD force on the cable. By Newton's 3rd law, the cable exerts
  // a DOWNWARD force on the support. So no uplift.
  // V_left < 0 means the left support must push DOWN on the cable
  // (the cable goes upward), so by Newton's 3rd law the cable pulls
  // the support UPWARD → uplift.

  const launchAnchorUplift = backstay.verticalReactionLeftN < 0
    ? Math.abs(backstay.verticalReactionLeftN)
    : 0;

  const launchAnchor = checkAnchor({
    label: 'Launch anchor',
    horizontalForceN: backstay.horizontalTensionN,
    verticalForceUpN: launchAnchorUplift,
    blocksPerAnchor: anchors.blocksPerAnchor,
    blockMassKg: anchors.blockMassKg,
    frictionCoefficient: anchors.groundFrictionCoefficient,
    requiredSlidingSF: anchors.slidingSafetyFactor,
  });

  // Brake anchor: pulled by the loaded main leg. The cable end at the
  // brake anchor has H horizontal (toward node) and V_right vertical.
  const brakeAnchorUplift = mainLegLoaded.verticalReactionRightN < 0
    ? Math.abs(mainLegLoaded.verticalReactionRightN)
    : 0;

  const brakeAnchor = checkAnchor({
    label: 'Brake anchor',
    horizontalForceN: mainLegLoaded.horizontalTensionN,
    verticalForceUpN: brakeAnchorUplift,
    blocksPerAnchor: anchors.blocksPerAnchor,
    blockMassKg: anchors.blockMassKg,
    frictionCoefficient: anchors.groundFrictionCoefficient,
    requiredSlidingSF: anchors.slidingSafetyFactor,
  });

  // ── Ground clearance ──────────────────────────────────────────────
  // The loaded main leg profile y values are relative to the left
  // support (master node). Convert to absolute elevation:
  // absolute_y = masterNode.y + profile.y
  // Ground at any x along the main leg: linear interp from
  // masterNode ground (0) to brakeAnchor ground (brakeAnchorElev).
  // But the master node is at height highPointElev, and the cable
  // profile left support is at y=0 (the node), so absolute cable
  // elevation = highPointElev + profile.y
  // Ground under the main leg goes from 0 at x=node station to
  // brakeAnchorElev at x=brake station. Simplified as linear.
  // The capture terminus (brakeAnchorElevationM) may sit above local
  // grade; terrain under the brake end = terminus − captureHeightAboveGround.
  // The minimum-clearance requirement applies to the FLIGHT span only,
  // up to brake-zone entry: the brake and capture zones are where the
  // trolley deliberately descends to the capture and are excluded.
  const brakeEndGroundM = site.brakeAnchorElevationM - site.captureHeightAboveGroundM;
  const flightEndX = Math.max(
    0,
    site.horizontalSpanM - site.brakeZoneLengthM - site.captureZoneLengthM,
  );
  let minClearance = Infinity;
  for (const pt of mainLegLoaded.profile) {
    if (pt.x > flightEndX) continue; // exclude brake + capture zones
    const absCableY = site.highPointElevationM + pt.y; // pt.y is negative for sag
    const frac = pt.x / site.horizontalSpanM;
    const groundY = frac * brakeEndGroundM; // linear terrain interpolation
    const payloadBottom = absCableY - trolley.payloadDropM;
    const clearance = payloadBottom - groundY;
    if (clearance < minClearance) minClearance = clearance;
  }
  if (!Number.isFinite(minClearance)) minClearance = 0; // degenerate-geometry guard
  const groundClearanceMarginM = minClearance - site.minGroundClearanceM;

  // ── Collect warnings ──────────────────────────────────────────────
  const allWarnings: string[] = [];
  const addW = (prefix: string, ws: string[]) =>
    ws.forEach((w) => allWarnings.push(`[${prefix}] ${w}`));

  addW('Backstay', backstay.warnings);
  addW('Main leg (loaded)', mainLegLoaded.warnings);
  addW('Master node', masterNode.warnings);
  addW('', launchAnchor.warnings);
  addW('', brakeAnchor.warnings);

  if (groundClearanceMarginM < 0) {
    allWarnings.push(
      `Ground clearance violated in the flight zone (up to brake entry): payload clears ` +
        `ground by only ${minClearance.toFixed(1)} m, which is ` +
        `${Math.abs(groundClearanceMarginM).toFixed(1)} m below the required ` +
        `${site.minGroundClearanceM.toFixed(1)} m minimum. Increase pretension, raise the ` +
        `high point, or raise the capture height above grade.`,
    );
  }

  const allAssumptions = [
    ...backstay.assumptions.map((a) => `[Backstay] ${a}`),
    ...mainLegLoaded.assumptions.map((a) => `[Main leg] ${a}`),
  ];

  return {
    layout,
    backstay,
    mainLegUnloaded,
    mainLegLoaded,
    masterNode,
    launchAnchor,
    brakeAnchor,
    groundClearanceMarginM,
    allWarnings,
    allAssumptions,
  };
}
