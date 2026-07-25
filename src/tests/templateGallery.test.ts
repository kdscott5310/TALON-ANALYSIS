/**
 * Milestone 6B — fixture-template instantiation and gallery-data tests.
 *
 * The gallery component is presentational; its safety-critical behavior is the
 * rule that only IMPLEMENTED templates can create a project. These tests cover
 * the registry gate and the store's `createFromTemplate` action directly (node
 * environment, localStorage stubbed for the store path).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FIXTURE_TEMPLATES,
  implementedTemplates,
  plannedTemplates,
  instantiateTemplate,
  type FixtureTemplateId,
} from '../core/templates/registry';
import {
  newProjectFromTemplate,
  seedExampleProject,
  useProjectStore,
} from '../state/projectStore';
import { checkProjectIntegrity } from '../core/model';
import { exampleScenario } from '../models/exampleScenario';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage;
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

describe('template gallery — catalogue', () => {
  it('lists the implemented templates (CUFTS + custom) and several planned ones', () => {
    const impl = implementedTemplates();
    expect(impl.map((t) => t.id)).toEqual(['cufts', 'customNodeElement']);
    expect(plannedTemplates().length).toBeGreaterThan(0);
    // Every planned template carries the milestone that will deliver it.
    for (const t of plannedTemplates()) {
      expect(t.milestone).toBeTruthy();
    }
    // Nothing is both implemented and planned.
    expect(impl.length + plannedTemplates().length).toBe(FIXTURE_TEMPLATES.length);
  });
});

describe('template instantiation — governance gate', () => {
  it('creates a CUFTS project matching the template definition', () => {
    const project = newProjectFromTemplate('cufts');
    expect(project.template.id).toBe('cufts');
    expect(project.template.name).toBe('TALON CUFTS fixture');
    // Seeded from the example scenario.
    expect(project.name).toBe(exampleScenario.name);
    expect(project.templateData.cufts).toBeDefined();
    expect(checkProjectIntegrity(project).some((i) => i.severity === 'error')).toBe(false);
  });

  it('refuses to instantiate a planned template — the throw is not swallowed', () => {
    for (const t of plannedTemplates()) {
      expect(() => newProjectFromTemplate(t.id)).toThrow(/not\s+implemented|planned/i);
      expect(() => instantiateTemplate(t.id, exampleScenario)).toThrow();
    }
  });

  it('rejects an unknown template id', () => {
    expect(() => newProjectFromTemplate('does-not-exist' as FixtureTemplateId)).toThrow(
      /unknown/i,
    );
  });
});

describe('template gallery — store action', () => {
  it('createFromTemplate("cufts") replaces the active project', () => {
    useProjectStore.getState().setProject({ ...seedExampleProject(), name: 'Prior' });
    expect(useProjectStore.getState().project.name).toBe('Prior');

    useProjectStore.getState().createFromTemplate('cufts');
    const active = useProjectStore.getState().project;
    expect(active.template.id).toBe('cufts');
    expect(active.name).toBe(exampleScenario.name);
    expect(useProjectStore.getState().notices).toEqual([]);
  });

  it('createFromTemplate throws for a planned template and leaves state usable', () => {
    const planned = plannedTemplates()[0];
    expect(() => useProjectStore.getState().createFromTemplate(planned.id)).toThrow();
    // The store still holds a valid project (the failed create did not corrupt it).
    expect(useProjectStore.getState().project.template.id).toBe('cufts');
    useProjectStore.getState().resetToExampleProject();
  });
});
