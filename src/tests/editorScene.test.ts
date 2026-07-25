/**
 * Milestone 6C — editor scene mapping tests.
 *
 * `buildEditorScene` is a pure Project → 2D-drawables mapping. These tests trace
 * every output back to the model geometry (node positions, element node
 * references, coordinate frames) so the canvas draws only what the model says.
 */
import { describe, it, expect } from 'vitest';
import { buildEditorScene } from '../visualizations/editorScene';
import { buildCuftsProject, CUFTS_IDS } from '../core/templates/cufts';
import { exampleScenario } from '../models/exampleScenario';
import { globalPosition } from '../core/coordinates';
import { ftToM } from '../units/units';
import type { Project } from '../core/model';
import type { Element } from '../core/elements';

function cufts(): Project {
  return buildCuftsProject(exampleScenario);
}

describe('editor scene — nodes', () => {
  it('maps every node onto the elevation plane at its global (x, z)', () => {
    const project = cufts();
    const scene = buildEditorScene(project);
    expect(scene.nodes.length).toBe(project.nodes.length);
    for (const node of project.nodes) {
      const drawn = scene.nodes.find((n) => n.id === node.id);
      expect(drawn).toBeDefined();
      const g = globalPosition(node, project.coordinateSystems);
      expect(drawn!.p.x).toBeCloseTo(g.x, 9);
      expect(drawn!.p.z).toBeCloseTo(g.z, 9);
      expect(drawn!.role).toBe(node.role);
    }
  });
});

describe('editor scene — elements', () => {
  it('builds one edge per two-node element with endpoints at its nodes', () => {
    const scene = buildEditorScene(cufts());
    // Two-node elements: backstay, main line, brake.
    expect(scene.edges.map((e) => e.id).sort()).toEqual(
      [CUFTS_IDS.backstayElement, CUFTS_IDS.mainLineElement, CUFTS_IDS.brakeElement].sort(),
    );

    const launch = scene.nodes.find((n) => n.id === CUFTS_IDS.launchAnchorNode)!;
    const master = scene.nodes.find((n) => n.id === CUFTS_IDS.masterNode)!;
    const backstay = scene.edges.find((e) => e.id === CUFTS_IDS.backstayElement)!;
    expect(backstay.a).toEqual(launch.p);
    expect(backstay.b).toEqual(master.p);
    expect(backstay.future).toBe(false);
  });

  it('turns single-node elements into attachments at their node', () => {
    const scene = buildEditorScene(cufts());
    expect(scene.attachments.map((a) => a.id).sort()).toEqual(
      [
        CUFTS_IDS.trolleyMassElement,
        CUFTS_IDS.launchAnchorElement,
        CUFTS_IDS.brakeAnchorElement,
      ].sort(),
    );
    const trolleyNode = scene.nodes.find((n) => n.id === CUFTS_IDS.trolleyNode)!;
    const trolleyMass = scene.attachments.find((a) => a.id === CUFTS_IDS.trolleyMassElement)!;
    expect(trolleyMass.nodeId).toBe(CUFTS_IDS.trolleyNode);
    expect(trolleyMass.p).toEqual(trolleyNode.p);
  });

  it('flags export-only (future) element types distinctly (Rule 11)', () => {
    const project = cufts();
    const beam: Element = {
      id: 'elem-future-beam',
      name: 'Export-only beam',
      type: 'beam',
      nodeIds: [CUFTS_IDS.launchAnchorNode, CUFTS_IDS.masterNode],
    };
    project.elements = [...project.elements, beam];
    const scene = buildEditorScene(project);
    const drawn = scene.edges.find((e) => e.id === 'elem-future-beam')!;
    expect(drawn.future).toBe(true);
    expect(scene.edges.find((e) => e.id === CUFTS_IDS.mainLineElement)!.future).toBe(false);
  });
});

describe('editor scene — frames and bounds', () => {
  it('exposes one marker per coordinate system with the global frame at origin', () => {
    const project = cufts();
    const scene = buildEditorScene(project);
    expect(scene.frames.length).toBe(project.coordinateSystems.length);
    const global = scene.frames.find((f) => f.kind === 'global')!;
    expect(global.p).toEqual({ x: 0, z: 0 });
  });

  it('bounds enclose the model extent', () => {
    const scene = buildEditorScene(cufts());
    const site = exampleScenario.site;
    const captureX = site.launchAnchorOffsetM + site.horizontalSpanM;
    expect(scene.bounds.minX).toBeCloseTo(0, 9);
    expect(scene.bounds.maxX).toBeCloseTo(captureX, 9);
    expect(scene.bounds.minZ).toBeCloseTo(0, 9);
    expect(scene.bounds.maxZ).toBeCloseTo(ftToM(200), 6);
    expect(scene.empty).toBe(false);
  });
});

describe('editor scene — determinism', () => {
  it('is pure: the same project yields an equal scene', () => {
    const project = cufts();
    expect(buildEditorScene(project)).toEqual(buildEditorScene(project));
  });
});
