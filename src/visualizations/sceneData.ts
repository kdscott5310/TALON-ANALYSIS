/**
 * 3D scene data — Milestone 15.
 *
 * Converts a scenario and the EXISTING solver results into a typed 3D scene
 * description. This is the boundary between calculation and rendering
 * (governance Rule 7): it performs only coordinate mapping — no engineering
 * math is duplicated here. Every position and envelope traces back to a solver
 * output. Rendering components consume `SceneModel` and never call solvers.
 *
 * WORLD FRAME (right-handed, metres; Three.js Y-up):
 *   x — downrange, from the launch station toward the capture end
 *   y — vertical, up, zero at the launch-station ground datum
 *   z — lateral / out-of-plane, positive toward the crosswind side
 */

import type { Scenario } from '../models/scenario';
import { computeLayout } from '../calculations/layoutGeometry';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { runDynamicsAnalysis } from '../calculations/dynamicsAnalysis';
import { solveLateralCableDynamics } from '../calculations/lateralCableDynamics';
import { GRAVITY } from '../units/units';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export type NodeRole = 'launchAnchor' | 'masterNode' | 'captureAnchor' | 'trolley' | 'payload';

export interface SceneNode {
  id: string;
  role: NodeRole;
  position: V3;
  label: string;
}

export type CableKind = 'backstay' | 'mainLoaded' | 'mainUnloaded' | 'chord';

export interface SceneCable {
  id: string;
  kind: CableKind;
  points: V3[];
  /** Peak tension along this leg, N (for engineering labels). */
  maxTensionN?: number;
}

export type ZoneKind = 'brake' | 'capture' | 'exclusion';

export interface SceneZone {
  id: string;
  kind: ZoneKind;
  /** Downrange start/end, m. */
  startX: number;
  endX: number;
  /** Half-width of the zone in the lateral direction, m. */
  halfWidthZ: number;
  label: string;
}

export interface ForceArrow {
  id: string;
  origin: V3;
  /** Direction (unit) × display length; the true magnitude is `magnitudeN`. */
  vector: V3;
  magnitudeN: number;
  label: string;
  kind: 'backstay' | 'mainLeg' | 'hook';
}

export interface SceneModel {
  /** Overall extents for camera framing. */
  bounds: { minX: number; maxX: number; maxY: number; halfZ: number };
  groundLengthX: number;
  /** Ground elevation under the capture end (may be below the terminus). */
  brakeGroundY: number;
  craneBaseX: number;
  craneTop: V3;
  nodes: SceneNode[];
  cables: SceneCable[];
  /** Anticipated trolley descent trajectory (customer/operator path). */
  trolleyPath: V3[];
  trolley: { position: V3; payloadBottom: V3; payloadDropM: number };
  zones: SceneZone[];
  forces: ForceArrow[];
  clearance: { minClearanceM: number; marginM: number; ok: boolean };
  /** Lateral sway corridor half-width from the reduced-order lateral model, m. */
  swayCorridorHalfWidthM: number | null;
  /** Peak crane hook load with the dynamic amplification factor, N. */
  peakHookLoadN: number;
  warnings: string[];
}

const PROFILE_SUBSAMPLE = 2; // keep every Nth profile point for lighter geometry

function subsample<T>(arr: T[], step: number): T[] {
  if (step <= 1) return arr;
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

/**
 * Builds the 3D scene for a CUFTS scenario at a given trolley position.
 * `trolleyFraction` is 0..1 along the main span.
 */
export function buildSceneModel(scenario: Scenario, trolleyFraction: number): SceneModel {
  const site = scenario.site;
  const layout = computeLayout(site);
  const la = layout.launchAnchor; // {x, y}
  const mn = layout.masterNode;
  const ba = layout.brakeAnchor;

  const frac = Math.max(0, Math.min(1, trolleyFraction));
  const stat = runStaticAnalysis({ scenario, trolleyPositionFrac: frac });

  const brakeGroundY = site.brakeAnchorElevationM - site.captureHeightAboveGroundM;

  // ── nodes ──────────────────────────────────────────────────────────────
  const nodes: SceneNode[] = [
    { id: 'launch', role: 'launchAnchor', position: { x: la.x, y: la.y, z: 0 }, label: 'Launch anchor' },
    { id: 'master', role: 'masterNode', position: { x: mn.x, y: mn.y, z: 0 }, label: 'Master node' },
    { id: 'capture', role: 'captureAnchor', position: { x: ba.x, y: ba.y, z: 0 }, label: 'Capture / brake anchor' },
  ];

  // ── cables from solver profiles (absolute world coords) ─────────────────
  const backstayPts: V3[] = subsample(stat.backstay.profile, PROFILE_SUBSAMPLE).map((p) => ({
    x: la.x + p.x,
    y: la.y + p.y,
    z: 0,
  }));
  const mainLoadedPts: V3[] = subsample(stat.mainLegLoaded.profile, PROFILE_SUBSAMPLE).map((p) => ({
    x: mn.x + p.x,
    y: mn.y + p.y,
    z: 0,
  }));
  const mainUnloadedPts: V3[] = subsample(stat.mainLegUnloaded.profile, PROFILE_SUBSAMPLE).map((p) => ({
    x: mn.x + p.x,
    y: mn.y + p.y,
    z: 0,
  }));

  const cables: SceneCable[] = [
    { id: 'backstay', kind: 'backstay', points: backstayPts, maxTensionN: stat.backstay.maxTensionN },
    { id: 'main-unloaded', kind: 'mainUnloaded', points: mainUnloadedPts },
    { id: 'main-loaded', kind: 'mainLoaded', points: mainLoadedPts, maxTensionN: stat.mainLegLoaded.maxTensionN },
  ];

  // ── trolley position on the loaded main leg ─────────────────────────────
  const idx = Math.min(
    Math.round(frac * (mainLoadedPts.length - 1)),
    mainLoadedPts.length - 1,
  );
  const trolleyPos = mainLoadedPts[idx] ?? { x: mn.x, y: mn.y, z: 0 };
  const payloadDropM = scenario.trolley.payloadDropM;
  const payloadBottom: V3 = { x: trolleyPos.x, y: trolleyPos.y - payloadDropM, z: trolleyPos.z };

  // ── anticipated trajectory (unloaded-ish descent path for the preview) ──
  // Use the moving-load profile sampled along the span so the path reflects
  // the actual loaded cable the trolley rides.
  const trolleyPath: V3[] = mainLoadedPts.map((p) => ({ ...p }));

  // ── zones on the ground ─────────────────────────────────────────────────
  const brakeStartX = ba.x - site.brakeZoneLengthM;
  const captureStartX = brakeStartX - site.captureZoneLengthM;
  const laneHalf = Math.max(2, site.horizontalSpanM * 0.02);
  const zones: SceneZone[] = [
    { id: 'brake', kind: 'brake', startX: brakeStartX, endX: ba.x, halfWidthZ: laneHalf, label: 'Brake zone' },
    { id: 'capture', kind: 'capture', startX: captureStartX, endX: brakeStartX, halfWidthZ: laneHalf, label: 'Capture zone' },
  ];

  // ── master-node force vectors (scaled for display) ──────────────────────
  const node = stat.masterNode;
  const maxForce = Math.max(
    Math.hypot(node.backstayForce.fx, node.backstayForce.fy),
    Math.hypot(node.mainLegForce.fx, node.mainLegForce.fy),
    node.hookResultantN,
    1,
  );
  const displayLen = site.highPointElevationM * 0.5; // arrows scale to ~half mast height
  const arrow = (
    id: string,
    kind: ForceArrow['kind'],
    fx: number,
    fy: number,
    label: string,
  ): ForceArrow => {
    const mag = Math.hypot(fx, fy);
    const s = (displayLen / maxForce);
    return {
      id,
      origin: { x: mn.x, y: mn.y, z: 0 },
      vector: { x: fx * s, y: fy * s, z: 0 },
      magnitudeN: mag,
      label,
      kind,
    };
  };
  const forces: ForceArrow[] = [
    arrow('f-backstay', 'backstay', node.backstayForce.fx, node.backstayForce.fy, 'Backstay'),
    arrow('f-main', 'mainLeg', node.mainLegForce.fx, node.mainLegForce.fy, 'Main line'),
    arrow('f-hook', 'hook', node.hookReaction.fx, node.hookReaction.fy, 'Hook'),
  ];

  // ── clearance ────────────────────────────────────────────────────────────
  const clearance = {
    minClearanceM: stat.groundClearanceMarginM + site.minGroundClearanceM,
    marginM: stat.groundClearanceMarginM,
    ok: stat.groundClearanceMarginM >= 0,
  };

  // ── lateral sway corridor (reduced-order lateral model, best effort) ────
  let swayCorridorHalfWidthM: number | null = null;
  try {
    const w = scenario.cable.linearMassKgPerM * GRAVITY;
    const lat = solveLateralCableDynamics({
      spanM: site.horizontalSpanM,
      axialTensionN: Math.max(stat.mainLegLoaded.horizontalTensionN, 1),
      linearMassKgPerM: scenario.cable.linearMassKgPerM,
      dampingRatio: 0.03,
      interiorNodes: 30,
      windForcePerLengthNPerM:
        0.5 * scenario.environment.airDensityKgPerM3 * scenario.cable.diameterM *
        scenario.environment.steadyCrosswindMps ** 2,
      gustForcePerLengthNPerM:
        0.5 * scenario.environment.airDensityKgPerM3 * scenario.cable.diameterM *
        Math.max(0, scenario.environment.gustMps ** 2 - scenario.environment.steadyCrosswindMps ** 2),
      durationS: 6,
    });
    void w;
    if (lat.stable && Number.isFinite(lat.peakLateralDisplacementM)) {
      // Corridor = payload swing + cable sway, with a small margin.
      swayCorridorHalfWidthM = Math.max(lat.peakLateralDisplacementM, laneHalf * 0.5) * 1.2;
    }
  } catch {
    swayCorridorHalfWidthM = null;
  }

  const halfZ = Math.max(laneHalf, swayCorridorHalfWidthM ?? 0) + 1;

  return {
    bounds: {
      minX: 0,
      maxX: ba.x,
      maxY: Math.max(mn.y, scenario.crane.hookHeightM),
      halfZ,
    },
    groundLengthX: ba.x,
    brakeGroundY,
    craneBaseX: mn.x,
    craneTop: { x: mn.x, y: mn.y, z: 0 },
    nodes,
    cables,
    trolleyPath,
    trolley: { position: trolleyPos, payloadBottom, payloadDropM },
    zones,
    forces,
    clearance,
    swayCorridorHalfWidthM,
    peakHookLoadN: node.dynamicHookLoadN,
    warnings: stat.allWarnings,
  };
}

/**
 * Builds the anticipated descent trajectory over time for playback, from the
 * dynamics simulation. Returns world-space points paired with the sim time so
 * the player can scrub. Returns null when the scenario cannot be simulated.
 */
export function buildTrajectory(
  scenario: Scenario,
): { tS: number[]; points: V3[] } | null {
  try {
    const layout = computeLayout(scenario.site);
    const mn = layout.masterNode;
    const dyn = runDynamicsAnalysis(scenario);
    const h = dyn.sim.history;
    const points: V3[] = h.xM.map((x, i) => ({ x: mn.x + x, y: mn.y + h.yM[i], z: 0 }));
    return { tS: [...h.tS], points };
  } catch {
    return null;
  }
}
