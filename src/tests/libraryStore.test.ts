/**
 * Milestone 7A — component-library store & browse-data guarantees.
 *
 * Vitest runs in the `node` environment (no localStorage), so these tests stub
 * localStorage to exercise the persistence path, and assert the browse-time
 * safety rules: seeds are never verified, corrupt data recovers with a notice,
 * and the store never collides with the project / v1 keys.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LIBRARY_STORAGE_KEY,
  seedLibraryState,
  loadPersistedLibrary,
  persistLibrary,
  useLibraryStore,
} from '../state/libraryStore';
import {
  auditLibrary,
  isRecordVerified,
  recordVerificationState,
  selectRecords,
} from '../core/library/componentLibrary';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage as unknown as Storage;
});
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

describe('library store — seeding & persistence', () => {
  it('seeds the example library when storage is empty', () => {
    const loaded = loadPersistedLibrary();
    expect(loaded.seeded).toBe(true);
    expect(loaded.notices).toEqual([]);
    expect(loaded.library.records.length).toBeGreaterThan(0);
  });

  it('persist → reload preserves the library', () => {
    const seed = seedLibraryState();
    persistLibrary(seed);
    expect(storage.getItem(LIBRARY_STORAGE_KEY)).not.toBeNull();
    const loaded = loadPersistedLibrary();
    expect(loaded.seeded).toBe(false);
    expect(loaded.library).toEqual(seed);
  });

  it('recovers from corrupt data with a visible notice, not a silent default', () => {
    storage.setItem(LIBRARY_STORAGE_KEY, 'not json {');
    const loaded = loadPersistedLibrary();
    expect(loaded.seeded).toBe(true);
    expect(loaded.notices[0]).toMatch(/discarded/i);
    expect(loaded.library.records.length).toBeGreaterThan(0);
  });

  it('does not touch the project or v1 scenario keys', () => {
    storage.setItem('talon-project-v1', 'project-sentinel');
    storage.setItem('talon-cufts-scenarios-v1', 'v1-sentinel');
    persistLibrary(seedLibraryState());
    expect(storage.getItem('talon-project-v1')).toBe('project-sentinel');
    expect(storage.getItem('talon-cufts-scenarios-v1')).toBe('v1-sentinel');
    expect(storage.getItem(LIBRARY_STORAGE_KEY)).not.toBeNull();
  });
});

describe('library browse-time safety', () => {
  it('no seeded record is verified; every one is example-only', () => {
    const lib = seedLibraryState();
    for (const r of lib.records) {
      expect(isRecordVerified(r)).toBe(false);
      expect(recordVerificationState(r)).toBe('exampleOnly');
    }
  });

  it('the audit flags example-only seeds as critical (not for design)', () => {
    const lib = seedLibraryState();
    const critical = auditLibrary(lib).filter((w) => w.severity === 'critical');
    expect(critical.length).toBe(lib.records.length);
  });

  it('category filtering returns only that category', () => {
    const lib = seedLibraryState();
    const cat = lib.records[0].category;
    const filtered = selectRecords(lib, cat);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => r.category === cat)).toBe(true);
  });
});

describe('library store — wiring', () => {
  it('exposes a library and browse actions', () => {
    const s = useLibraryStore.getState();
    expect(s.library.records.length).toBeGreaterThan(0);
    expect(typeof s.resetToSeedLibrary).toBe('function');
    expect(typeof s.setLibrary).toBe('function');
    expect(typeof s.dismissNotices).toBe('function');
  });
});
