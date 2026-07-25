/**
 * Milestone 6D — custom project + geometry edit operations.
 *
 * Covers the pure add/move/delete operations (immutability + referential
 * integrity + cascades) and the key durability property: a custom project's
 * edited geometry round-trips through serialization UNCHANGED (it is
 * authoritative, not re-derived like CUFTS).
 */
import { describe, it, expect } from 'vitest';
import { createCustomProject, isCustomProject } from '../core/templates/custom';
import { addNode, moveNode, deleteNode, addElement, deleteElement } from '../core/projectEdits';
import { checkProjectIntegrity } from '../core/model';
import { buildCuftsProject } from '../core/templates/cufts';
import { exampleScenario } from '../models/exampleScenario';
import {
  exportProjectJson,
  importProjectJson,
  PROJECT_FILE_TYPE,
} from '../core/projectSerialization';

const noErrors = (p: ReturnType<typeof createCustomProject>) =>
  expect(checkProjectIntegrity(p).some((i) => i.severity === 'error')).toBe(false);

describe('custom project', () => {
  it('is valid, editable, and distinct from CUFTS', () => {
    const custom = createCustomProject();
    expect(isCustomProject(custom)).toBe(true);
    expect(custom.template.id).toBe('customNodeElement');
    expect(custom.templateData.cufts).toBeUndefined();
    expect(custom.nodes.length).toBeGreaterThan(0);
    noErrors(custom);
    expect(isCustomProject(buildCuftsProject(exampleScenario))).toBe(false);
  });
});

describe('node edits', () => {
  it('addNode appends a node without mutating the input', () => {
    const p0 = createCustomProject();
    const { project: p1, nodeId } = addNode(p0, { x: 5, z: 3 });
    expect(p1.nodes.length).toBe(p0.nodes.length + 1);
    expect(p0.nodes.length).toBe(2); // original untouched
    const added = p1.nodes.find((n) => n.id === nodeId)!;
    expect(added.position).toEqual({ x: 5, y: 0, z: 3 });
    noErrors(p1);
  });

  it('moveNode updates position, preserves y, and is immutable', () => {
    const p0 = createCustomProject();
    const p1 = moveNode(p0, 'node-1', { x: 7, z: 2 });
    expect(p1.nodes.find((n) => n.id === 'node-1')!.position).toEqual({ x: 7, y: 0, z: 2 });
    expect(p0.nodes.find((n) => n.id === 'node-1')!.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('deleteNode cascades to elements that referenced it', () => {
    let p = createCustomProject();
    p = addNode(p, { x: 20, z: 0 }, { id: 'node-3' }).project;
    p = addElement(p, 'node-1', 'node-3', { id: 'elem-1' }).project;
    expect(p.elements.length).toBe(1);
    p = deleteNode(p, 'node-3');
    expect(p.nodes.some((n) => n.id === 'node-3')).toBe(false);
    expect(p.elements.length).toBe(0); // dependent element removed
    noErrors(p);
  });
});

describe('element edits', () => {
  it('addElement connects two nodes with a cable', () => {
    const p0 = createCustomProject();
    const { project: p1, elementId } = addElement(p0, 'node-1', 'node-2');
    const el = p1.elements.find((e) => e.id === elementId)!;
    expect(el.type).toBe('cable');
    expect(el.nodeIds).toEqual(['node-1', 'node-2']);
    noErrors(p1);
  });

  it('addElement rejects self-loops and unknown nodes', () => {
    const p0 = createCustomProject();
    expect(() => addElement(p0, 'node-1', 'node-1')).toThrow(/two distinct/i);
    expect(() => addElement(p0, 'node-1', 'ghost')).toThrow(/existing nodes/i);
  });

  it('deleteElement removes only the element', () => {
    let p = createCustomProject();
    p = addElement(p, 'node-1', 'node-2', { id: 'elem-1' }).project;
    p = deleteElement(p, 'elem-1');
    expect(p.elements.length).toBe(0);
    expect(p.nodes.length).toBe(2); // nodes untouched
    noErrors(p);
  });
});

describe('custom project durability (the 6D reason for this template)', () => {
  it('round-trips edited geometry through serialization unchanged', () => {
    let p = createCustomProject({ id: 'proj-x', createdOn: '2026-07-24T00:00:00.000Z' });
    p = addNode(p, { x: 15, z: 8 }, { id: 'node-3' }).project;
    p = addElement(p, 'node-2', 'node-3', { id: 'elem-1' }).project;

    const json = exportProjectJson(p, '1.1.0');
    const result = importProjectJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Geometry is authoritative — reloaded exactly, not re-derived.
      expect(result.project).toEqual(p);
      expect(result.project.nodes.map((n) => n.id)).toContain('node-3');
      expect(result.project.elements.map((e) => e.id)).toContain('elem-1');
    }
  });

  it('rejects a custom project with a dangling element reference', () => {
    const custom = createCustomProject();
    const raw = {
      fileType: PROJECT_FILE_TYPE,
      schemaVersion: 2,
      project: {
        ...custom,
        elements: [{ id: 'e1', type: 'cable', nodeIds: ['node-1', 'ghost'] }],
      },
    };
    const result = importProjectJson(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/ghost/);
  });
});
