/**
 * Milestone 6A — project store persistence, recovery, and safety tests.
 *
 * Vitest runs in the `node` environment (no localStorage), so these tests
 * install an in-memory localStorage stub to exercise the persistence path,
 * then exercise the store's exported pure helpers directly (independent of the
 * module-singleton store).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PROJECT_STORAGE_KEY,
  seedExampleProject,
  loadPersistedProject,
  persistProject,
  useProjectStore,
} from '../state/projectStore';
import { PROJECT_SCHEMA_VERSION, checkProjectIntegrity } from '../core/model';
import { isMissing, type Quantity } from '../core/provenance';

const V1_SCENARIO_KEY = 'talon-cufts-scenarios-v1';

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

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    storage as unknown as Storage;
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

describe('project store — seeding', () => {
  it('seeds a CUFTS project when storage is empty', () => {
    const loaded = loadPersistedProject();
    expect(loaded.seeded).toBe(true);
    expect(loaded.notices).toEqual([]);
    expect(loaded.project.template.id).toBe('cufts');
    expect(loaded.project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    // The seed carries the built-in example, which is explicitly unverified.
    expect(loaded.project.templateData.cufts?.isUnverifiedExample).toBe(true);
    // A well-formed project (referential integrity holds).
    expect(checkProjectIntegrity(loaded.project).some((i) => i.severity === 'error')).toBe(false);
  });

  it('seedExampleProject builds a non-empty, integral CUFTS project', () => {
    const p = seedExampleProject();
    expect(p.nodes.length).toBeGreaterThan(0);
    expect(p.elements.length).toBeGreaterThan(0);
    expect(checkProjectIntegrity(p).some((i) => i.severity === 'error')).toBe(false);
  });
});

describe('project store — persistence round-trip', () => {
  it('persist → reload preserves the project', () => {
    const seed = seedExampleProject();
    persistProject(seed);

    expect(storage.getItem(PROJECT_STORAGE_KEY)).not.toBeNull();

    const loaded = loadPersistedProject();
    expect(loaded.seeded).toBe(false);
    expect(loaded.notices).toEqual([]);
    // Re-derived from the stored scenario with the same ids/timestamps → equal.
    expect(loaded.project).toEqual(seed);
  });
});

describe('project store — corrupt-data recovery', () => {
  it('recovers from non-JSON with a visible notice, not a silent default', () => {
    storage.setItem(PROJECT_STORAGE_KEY, 'not json {');
    const loaded = loadPersistedProject();
    expect(loaded.seeded).toBe(true);
    expect(loaded.notices.length).toBeGreaterThan(0);
    expect(loaded.notices[0]).toMatch(/discarded/i);
    // Recovered to a real project, never an empty/zeroed one.
    expect(loaded.project.template.id).toBe('cufts');
    expect(loaded.project.nodes.length).toBeGreaterThan(0);
  });

  it('recovers from a structurally invalid project envelope with a notice', () => {
    storage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({
        fileType: 'talon-project',
        schemaVersion: 2,
        project: { schemaVersion: 2, template: { id: 'cufts' }, templateData: {} },
      }),
    );
    const loaded = loadPersistedProject();
    expect(loaded.seeded).toBe(true);
    expect(loaded.notices.length).toBeGreaterThan(0);
    expect(loaded.project.template.id).toBe('cufts');
  });
});

describe('project store — safety invariants', () => {
  it('missing engineering data stays null, never coerced to zero (Rule 4)', () => {
    const p = seedExampleProject();
    const cable = p.elements.find((e) => e.type === 'cable');
    expect(cable).toBeDefined();
    // EA is not supplied by the v1 scenario — it must be missing, not 0.
    const ea = (cable as unknown as { axialStiffness: Quantity }).axialStiffness;
    expect(ea.value).toBeNull();
    expect(ea.provenance.state).toBe('missing');
    expect(isMissing(ea)).toBe(true);
  });

  it('does not touch the v1 scenario storage key', () => {
    storage.setItem(V1_SCENARIO_KEY, 'v1-sentinel');
    persistProject(seedExampleProject());
    // Project persistence writes only its own key.
    expect(storage.getItem(V1_SCENARIO_KEY)).toBe('v1-sentinel');
    expect(storage.getItem(PROJECT_STORAGE_KEY)).not.toBeNull();
  });
});

describe('project store — store wiring', () => {
  it('exposes an active project and actions', () => {
    const s = useProjectStore.getState();
    expect(s.project.template.id).toBe('cufts');
    expect(typeof s.setProject).toBe('function');
    expect(typeof s.resetToExampleProject).toBe('function');
    expect(typeof s.dismissNotices).toBe('function');

    // toProjectJson serializes the active project.
    const json = s.toProjectJson();
    expect(json).toContain('"fileType": "talon-project"');
  });

  it('setProject immutably replaces the active project', () => {
    const before = useProjectStore.getState().project;
    const renamed = { ...seedExampleProject(), name: 'Renamed project' };
    useProjectStore.getState().setProject(renamed);
    const after = useProjectStore.getState().project;
    expect(after.name).toBe('Renamed project');
    expect(after).not.toBe(before);
    // restore for any later tests
    useProjectStore.getState().resetToExampleProject();
  });
});
