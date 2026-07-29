/**
 * Milestone 9A — standards model, edits, serialization & sharing round-trip.
 *
 * The standards document must round-trip through JSON (the Git-sharing
 * mechanism) unchanged; the shipped default is a clearly-flagged starter
 * template; edits are immutable; a malformed or too-new file is rejected.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDefaultStandards,
  setDesignFactor,
  removeDesignFactor,
  setAllowableLimit,
  updateStandardsMeta,
  checkStandards,
} from '../core/standards';
import { exportStandardsJson, importStandardsJson, STANDARDS_FILE_TYPE } from '../core/standardsIo';
import {
  STANDARDS_STORAGE_KEY,
  loadPersistedStandards,
  persistStandards,
  useStandardsStore,
} from '../state/standardsStore';

describe('standards model', () => {
  it('ships a clearly-flagged starter template that warns until approved', () => {
    const s = createDefaultStandards();
    expect(s.starterTemplate).toBe(true);
    expect(s.designFactors.length).toBeGreaterThan(0);
    const warnings = checkStandards(s).filter((i) => i.severity === 'warning');
    expect(warnings.some((w) => /starter-template|not authoritative/i.test(w.message))).toBe(true);
  });

  it('edits are immutable and set/replace by key', () => {
    const s0 = createDefaultStandards();
    const s1 = setDesignFactor(s0, { key: 'cable', label: 'Cable', value: 8 });
    expect(s0.designFactors.find((d) => d.key === 'cable')!.value).toBe(5); // original untouched
    expect(s1.designFactors.find((d) => d.key === 'cable')!.value).toBe(8);
    expect(s1.designFactors.length).toBe(s0.designFactors.length); // replaced, not added
    const s2 = setDesignFactor(s1, { key: 'new', label: 'New', value: 2 });
    expect(s2.designFactors.length).toBe(s0.designFactors.length + 1);
    expect(removeDesignFactor(s2, 'new').designFactors.length).toBe(s0.designFactors.length);
    const s3 = updateStandardsMeta(s0, { starterTemplate: false });
    expect(s3.starterTemplate).toBe(false);
  });

  it('flags a design factor below 1', () => {
    const s = setDesignFactor(createDefaultStandards(), { key: 'x', label: 'x', value: 0.5 });
    expect(checkStandards(s).some((i) => /below 1/i.test(i.message))).toBe(true);
  });
});

describe('standards serialization (the sharing mechanism)', () => {
  it('round-trips through JSON unchanged', () => {
    let s = updateStandardsMeta(createDefaultStandards(), { name: 'Acme standards', revision: '3', starterTemplate: false });
    s = setAllowableLimit(s, { key: 'minGroundClearance', label: 'Min clearance', valueSI: 0.75, dimension: 'length', kind: 'min' });
    const result = importStandardsJson(exportStandardsJson(s, '1.1.0'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.standards).toEqual(s);
      expect(result.standards.starterTemplate).toBe(false); // approved stays approved
    }
  });

  it('rejects a malformed / wrong-type / too-new file with a reason', () => {
    expect(importStandardsJson('{ bad json').ok).toBe(false);
    expect(importStandardsJson(JSON.stringify({ fileType: 'other', schemaVersion: 1, standards: {} })).ok).toBe(false);
    const future = JSON.parse(exportStandardsJson(createDefaultStandards(), '1.1.0'));
    future.schemaVersion = 99;
    const r = importStandardsJson(JSON.stringify(future));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/newer than this build/i);
  });

  it('exports a talon-standards envelope', () => {
    expect(exportStandardsJson(createDefaultStandards(), '1.1.0')).toContain(`"fileType": "${STANDARDS_FILE_TYPE}"`);
  });
});

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
}

describe('standards store', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
  });

  it('seeds the starter template when empty and persists/reloads', () => {
    const seeded = loadPersistedStandards();
    expect(seeded.seeded).toBe(true);
    persistStandards(updateStandardsMeta(seeded.standards, { revision: '7' }));
    const reloaded = loadPersistedStandards();
    expect(reloaded.seeded).toBe(false);
    expect(reloaded.standards.revision).toBe('7');
  });

  it('recovers corrupt data with a visible notice', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(STANDARDS_STORAGE_KEY, 'not json {');
    const loaded = loadPersistedStandards();
    expect(loaded.seeded).toBe(true);
    expect(loaded.notices[0]).toMatch(/discarded/i);
  });

  it('exposes standards and actions', () => {
    const s = useStandardsStore.getState();
    expect(s.standards.designFactors.length).toBeGreaterThan(0);
    expect(typeof s.setStandards).toBe('function');
    expect(typeof s.resetToStarter).toBe('function');
  });
});
