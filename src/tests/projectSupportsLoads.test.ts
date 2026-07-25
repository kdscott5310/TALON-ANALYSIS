/**
 * Milestone 6E — supports, constraints, loads, load cases & combinations.
 *
 * Pure, immutable operations with referential-integrity cascades, plus the
 * durability property: a custom project carrying boundary conditions and
 * loading round-trips through serialization unchanged.
 */
import { describe, it, expect } from 'vitest';
import {
  setSupport,
  removeSupport,
  addPointForceLoad,
  removeLoad,
  addConstraint,
  removeConstraint,
  addLoadCase,
  removeLoadCase,
  addLoadCombination,
  removeLoadCombination,
  deleteNode,
} from '../core/projectEdits';
import { createCustomProject } from '../core/templates/custom';
import { checkProjectIntegrity, type Project } from '../core/model';
import { exportProjectJson, importProjectJson } from '../core/projectSerialization';

const clean = (p: Project) =>
  expect(checkProjectIntegrity(p).some((i) => i.severity === 'error')).toBe(false);

describe('supports', () => {
  it('sets one support per node and replaces on re-set', () => {
    const p0 = createCustomProject();
    const { project: p1, supportId } = setSupport(p0, 'node-1', {
      kind: 'pinned',
      restrained: { x: true, y: true, z: true },
    });
    expect(p1.supports).toHaveLength(1);
    expect(p0.supports).toHaveLength(0); // immutable
    clean(p1);

    const { project: p2 } = setSupport(p1, 'node-1', { kind: 'roller', restrained: { x: false, y: false, z: true } });
    expect(p2.supports).toHaveLength(1); // replaced, not stacked
    expect(p2.supports[0].kind).toBe('roller');
    expect(p2.supports[0].id).toBe(supportId);

    const p3 = removeSupport(p2, supportId);
    expect(p3.supports).toHaveLength(0);
  });

  it('rejects a support on an unknown node', () => {
    expect(() => setSupport(createCustomProject(), 'ghost', { kind: 'fixed', restrained: { x: true, y: true, z: true } })).toThrow(/existing node/i);
  });
});

describe('loads', () => {
  it('adds a frame-tagged point force in SI newtons', () => {
    const { project, loadId } = addPointForceLoad(createCustomProject(), { nodeId: 'node-1', fxN: 500, fzN: -1200 });
    const load = project.loads.find((l) => l.id === loadId)!;
    expect(load.kind).toBe('pointForce');
    expect(load.csId).toBe('cs-global');
    expect(load.components?.x?.value).toBe(500);
    expect(load.components?.z?.value).toBe(-1200);
    expect(load.components?.x?.dimension).toBe('force');
    clean(project);
  });
});

describe('constraints', () => {
  it('ties DOF between two nodes and rejects unknown nodes', () => {
    const p0 = createCustomProject();
    const { project, constraintId } = addConstraint(p0, { kind: 'equalDof', nodeIds: ['node-1', 'node-2'] });
    expect(project.constraints).toHaveLength(1);
    clean(project);
    expect(removeConstraint(project, constraintId).constraints).toHaveLength(0);
    expect(() => addConstraint(p0, { kind: 'equalDof', nodeIds: ['node-1', 'ghost'] })).toThrow(/existing nodes/i);
  });
});

describe('load cases & combinations', () => {
  it('groups loads into a case and cases into an unfactored combination', () => {
    let p = createCustomProject();
    const a = addPointForceLoad(p, { nodeId: 'node-1', fxN: 100, fzN: 0 });
    p = a.project;
    const b = addPointForceLoad(p, { nodeId: 'node-2', fxN: 0, fzN: -50 });
    p = b.project;

    const lc = addLoadCase(p, { name: 'Operating', loadIds: [a.loadId, b.loadId] });
    p = lc.project;
    expect(p.loadCases[0].factors.map((f) => f.loadId)).toEqual([a.loadId, b.loadId]);

    const combo = addLoadCombination(p, { name: 'Service', loadCaseIds: [lc.loadCaseId] });
    p = combo.project;
    expect(p.loadCombinations[0].terms).toEqual([{ loadCaseId: lc.loadCaseId, factor: 1 }]);
    // No building-code combination is ever assumed.
    expect(p.loadCombinations[0].standard).toBeUndefined();
    clean(p);

    p = removeLoadCombination(p, combo.combinationId);
    p = removeLoadCase(p, lc.loadCaseId);
    expect(p.loadCombinations).toHaveLength(0);
    expect(p.loadCases).toHaveLength(0);
  });

  it('rejects cases/combinations that reference unknown members', () => {
    const p = createCustomProject();
    expect(() => addLoadCase(p, { name: 'x', loadIds: ['ghost-load'] })).toThrow(/existing loads/i);
    expect(() => addLoadCombination(p, { name: 'y', loadCaseIds: ['ghost-case'] })).toThrow(/existing load cases/i);
  });
});

describe('cascades keep integrity', () => {
  it('removing a load prunes it from load-case factors', () => {
    let p = createCustomProject();
    const a = addPointForceLoad(p, { nodeId: 'node-1', fxN: 100, fzN: 0 });
    p = a.project;
    p = addLoadCase(p, { name: 'C', loadIds: [a.loadId] }).project;
    p = removeLoad(p, a.loadId);
    expect(p.loadCases[0].factors).toHaveLength(0);
    clean(p);
  });

  it('deleting a node removes its support and loads and prunes case factors', () => {
    let p = createCustomProject();
    p = setSupport(p, 'node-1', { kind: 'fixed', restrained: { x: true, y: true, z: true } }).project;
    const a = addPointForceLoad(p, { nodeId: 'node-1', fxN: 100, fzN: 0 });
    p = a.project;
    p = addLoadCase(p, { name: 'C', loadIds: [a.loadId] }).project;

    p = deleteNode(p, 'node-1');
    expect(p.supports).toHaveLength(0);
    expect(p.loads).toHaveLength(0);
    expect(p.loadCases[0].factors).toHaveLength(0);
    clean(p);
  });
});

describe('durability', () => {
  it('round-trips a custom project with supports, loads, cases and combinations', () => {
    let p = createCustomProject({ id: 'proj-6e', createdOn: '2026-07-24T00:00:00.000Z' });
    p = setSupport(p, 'node-1', { kind: 'pinned', restrained: { x: true, y: true, z: true } }).project;
    const a = addPointForceLoad(p, { nodeId: 'node-2', fxN: 250, fzN: -400 });
    p = a.project;
    p = addConstraint(p, { kind: 'equalDof', nodeIds: ['node-1', 'node-2'] }).project;
    const lc = addLoadCase(p, { name: 'Op', loadIds: [a.loadId] });
    p = lc.project;
    p = addLoadCombination(p, { name: 'Svc', loadCaseIds: [lc.loadCaseId] }).project;

    const result = importProjectJson(exportProjectJson(p, '1.1.0'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project).toEqual(p);
  });
});
