/**
 * Milestone 15 — 3D scene-data mapping.
 *
 * Verifies the calculation/rendering boundary: the scene traces node
 * positions, cable polylines, and clearance directly to solver outputs, with
 * only coordinate mapping applied (no engineering math duplicated).
 */
import { describe, it, expect } from 'vitest';
import { buildSceneModel, buildTrajectory } from '../visualizations/sceneData';
import { computeLayout } from '../calculations/layoutGeometry';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { exampleScenario } from '../models/exampleScenario';

describe('scene node mapping', () => {
  const scene = buildSceneModel(exampleScenario, 0.3);
  const layout = computeLayout(exampleScenario.site);

  it('places anchors and master node at the layout stations', () => {
    const launch = scene.nodes.find((n) => n.role === 'launchAnchor')!;
    const master = scene.nodes.find((n) => n.role === 'masterNode')!;
    const capture = scene.nodes.find((n) => n.role === 'captureAnchor')!;
    expect(launch.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(master.position.x).toBeCloseTo(layout.masterNode.x, 9);
    expect(master.position.y).toBeCloseTo(layout.masterNode.y, 9);
    expect(capture.position.x).toBeCloseTo(layout.brakeAnchor.x, 9);
  });

  it('crane mast top coincides with the master node', () => {
    expect(scene.craneTop).toEqual(scene.nodes.find((n) => n.role === 'masterNode')!.position);
    expect(scene.craneBaseX).toBeCloseTo(layout.masterNode.x, 9);
  });
});

describe('cable polylines trace solver profiles', () => {
  it('main-loaded cable endpoints match the solved profile in world coords', () => {
    const frac = 0.3;
    const scene = buildSceneModel(exampleScenario, frac);
    const stat = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: frac });
    const layout = computeLayout(exampleScenario.site);
    const main = scene.cables.find((c) => c.kind === 'mainLoaded')!;
    // First point = master node; last point = capture anchor.
    expect(main.points[0].x).toBeCloseTo(layout.masterNode.x + stat.mainLegLoaded.profile[0].x, 6);
    expect(main.points[0].y).toBeCloseTo(layout.masterNode.y + stat.mainLegLoaded.profile[0].y, 6);
    const lastProfile = stat.mainLegLoaded.profile[stat.mainLegLoaded.profile.length - 1];
    const lastPt = main.points[main.points.length - 1];
    expect(lastPt.x).toBeCloseTo(layout.masterNode.x + lastProfile.x, 6);
    expect(lastPt.y).toBeCloseTo(layout.masterNode.y + lastProfile.y, 6);
    // Carries the solver's peak tension for labeling (not recomputed).
    expect(main.maxTensionN).toBe(stat.mainLegLoaded.maxTensionN);
  });

  it('provides backstay, unloaded and loaded main cables', () => {
    const scene = buildSceneModel(exampleScenario, 0.5);
    expect(scene.cables.map((c) => c.kind).sort()).toEqual(
      ['backstay', 'mainLoaded', 'mainUnloaded'].sort(),
    );
    for (const c of scene.cables) expect(c.points.length).toBeGreaterThan(2);
  });
});

describe('clearance and forces trace solver outputs', () => {
  it('clearance margin equals the static-analysis margin', () => {
    const frac = 0.5;
    const scene = buildSceneModel(exampleScenario, frac);
    const stat = runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: frac });
    expect(scene.clearance.marginM).toBeCloseTo(stat.groundClearanceMarginM, 9);
    expect(scene.clearance.ok).toBe(stat.groundClearanceMarginM >= 0);
  });

  it('emits three master-node force arrows scaled from the equilibrium result', () => {
    const scene = buildSceneModel(exampleScenario, 0.4);
    expect(scene.forces.map((f) => f.kind).sort()).toEqual(['backstay', 'hook', 'mainLeg']);
    // All arrows originate at the master node.
    for (const f of scene.forces) {
      expect(f.origin).toEqual(scene.craneTop);
      expect(f.magnitudeN).toBeGreaterThan(0);
    }
  });

  it('decouples the brake-end ground from the terminus (v1.1.0 model)', () => {
    const scene = buildSceneModel(exampleScenario, 0.5);
    // With capture height 0 in the baseline, brake ground = terminus elevation.
    expect(scene.brakeGroundY).toBeCloseTo(
      exampleScenario.site.brakeAnchorElevationM - exampleScenario.site.captureHeightAboveGroundM,
      9,
    );
  });
});

describe('zones and trolley', () => {
  const scene = buildSceneModel(exampleScenario, 0.6);

  it('positions the brake and capture zones adjacent to the capture end', () => {
    const brake = scene.zones.find((z) => z.kind === 'brake')!;
    const capture = scene.zones.find((z) => z.kind === 'capture')!;
    expect(brake.endX).toBeCloseTo(scene.bounds.maxX, 6);
    expect(brake.startX).toBeCloseTo(scene.bounds.maxX - exampleScenario.site.brakeZoneLengthM, 6);
    // Capture zone sits just uphill of the brake zone.
    expect(capture.endX).toBeCloseTo(brake.startX, 6);
  });

  it('hangs the payload the drop distance below the trolley', () => {
    expect(scene.trolley.payloadBottom.y).toBeCloseTo(
      scene.trolley.position.y - exampleScenario.trolley.payloadDropM,
      9,
    );
  });
});

describe('trajectory for playback', () => {
  it('builds a time-stamped world-space descent path', () => {
    const traj = buildTrajectory(exampleScenario);
    expect(traj).not.toBeNull();
    if (!traj) return;
    expect(traj.tS.length).toBe(traj.points.length);
    expect(traj.tS.length).toBeGreaterThan(10);
    // Monotonic time; downrange progress.
    expect(traj.tS[0]).toBeLessThan(traj.tS[traj.tS.length - 1]);
    expect(traj.points[traj.points.length - 1].x).toBeGreaterThan(traj.points[0].x);
  });
});
