/**
 * Milestone 6F — dimensioned properties, provenance, and unit display.
 *
 * Verifies the provenance rules the property inspector must uphold:
 *  - missing stays null, never 0 (Rules 3/4);
 *  - editing a value preserves the original source value (Rule 5);
 *  - verification state is honest (unverified never reads as verified);
 *  - dimension-aware display round-trips through the units boundary.
 */
import { describe, it, expect } from 'vitest';
import {
  addMaterial,
  setElementMaterial,
  setElementProperty,
  setMaterialProperty,
  updatedQuantity,
  addElement,
} from '../core/projectEdits';
import { createCustomProject } from '../core/templates/custom';
import { checkProjectIntegrity, type Project } from '../core/model';
import { isMissing, isVerified, quantity, missing } from '../core/provenance';
import { exportProjectJson, importProjectJson } from '../core/projectSerialization';
import {
  displayUnitLabel,
  fromDisplayValue,
  toDisplayValue,
} from '../units/units';

const clean = (p: Project) =>
  expect(checkProjectIntegrity(p).some((i) => i.severity === 'error')).toBe(false);

function customWithCable(): { project: Project; cableId: string } {
  const p0 = createCustomProject();
  const { project, elementId } = addElement(p0, 'node-1', 'node-2', { id: 'elem-1' });
  return { project, cableId: elementId };
}

describe('updatedQuantity — provenance rules', () => {
  it('a missing value stays null and is flagged missing, never zero', () => {
    const q = updatedQuantity(undefined, null, 'missing', 'force');
    expect(q.value).toBeNull();
    expect(q.provenance.state).toBe('missing');
    expect(isMissing(q)).toBe(true);
  });

  it('editing the value preserves the original source value (Rule 5)', () => {
    // A derated quantity: working value 800 N, published source 1000 N.
    const derated = quantity(800, 'force', 'manufacturerVerified');
    derated.sourceValue = 1000;
    const edited = updatedQuantity(derated, 900, 'userVerified', 'force');
    expect(edited.value).toBe(900);
    expect(edited.sourceValue).toBe(1000); // source preserved, not overwritten
    expect(edited.provenance.state).toBe('userVerified');
  });

  it('carries no sourceValue when the original had none (clean round-trip)', () => {
    const q = updatedQuantity(undefined, 5, 'provisional', 'length');
    expect('sourceValue' in q).toBe(false);
    expect(isVerified(q.provenance.state)).toBe(false);
  });
});

describe('element & material property edits', () => {
  it('sets a dimensioned property on a cable in SI', () => {
    const { project, cableId } = customWithCable();
    const p1 = setElementProperty(project, cableId, 'diameter', quantity(0.012, 'length', 'provisional'));
    const cable = p1.elements.find((e) => e.id === cableId) as unknown as { diameter: { value: number } };
    expect(cable.diameter.value).toBe(0.012);
    expect(project.elements.find((e) => e.id === cableId)).not.toHaveProperty('diameter'); // immutable
    clean(p1);
  });

  it('clearing a property marks it missing, never zero', () => {
    const { project, cableId } = customWithCable();
    let p = setElementProperty(project, cableId, 'pretension', quantity(5000, 'force', 'provisional'));
    p = setElementProperty(p, cableId, 'pretension', missing('force'));
    const cable = p.elements.find((e) => e.id === cableId) as unknown as { pretension: { value: number | null } };
    expect(cable.pretension.value).toBeNull();
  });

  it('adds a material, attaches it, and edits its properties', () => {
    const { project, cableId } = customWithCable();
    const { project: p1, materialId } = addMaterial(project, { name: 'HMPE' });
    const p2 = setElementMaterial(p1, cableId, materialId);
    expect((p2.elements.find((e) => e.id === cableId) as { materialId?: string }).materialId).toBe(materialId);
    const p3 = setMaterialProperty(p2, materialId, 'elasticModulus', quantity(1.1e11, 'pressure', 'estimated'));
    const mat = p3.materials.find((m) => m.id === materialId) as unknown as { elasticModulus: { value: number } };
    expect(mat.elasticModulus.value).toBe(1.1e11);
    clean(p3);
    expect(() => setElementMaterial(project, cableId, 'ghost')).toThrow(/unknown material/i);
  });
});

describe('dimension-aware unit display', () => {
  it('round-trips display↔SI for US customary and labels dimensionless as unitless', () => {
    // length: 10 m -> ~32.8084 ft -> 10 m
    const ft = toDisplayValue(10, 'length', 'us');
    expect(ft).toBeCloseTo(32.8084, 3);
    expect(fromDisplayValue(ft, 'length', 'us')).toBeCloseTo(10, 9);
    expect(displayUnitLabel('force', 'us')).toBe('lbf');
    expect(displayUnitLabel('force', 'si')).toBe('N');
    expect(displayUnitLabel('dimensionless', 'us')).toBe('');
    // SI system is identity.
    expect(toDisplayValue(500, 'force', 'si')).toBe(500);
  });
});

describe('durability', () => {
  it('round-trips a cable with properties and a material, preserving provenance', () => {
    let { project, cableId } = customWithCable();
    project = setElementProperty(project, cableId, 'diameter', quantity(0.012, 'length', 'userVerified'));
    project = setElementProperty(project, cableId, 'minBreakingStrength', missing('force'));
    const withMat = addMaterial(project, { name: 'HMPE' });
    project = setElementMaterial(withMat.project, cableId, withMat.materialId);
    project = setMaterialProperty(project, withMat.materialId, 'density', quantity(980, 'density', 'estimated'));

    const result = importProjectJson(exportProjectJson(project, '1.1.0'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project).toEqual(project);
  });
});
