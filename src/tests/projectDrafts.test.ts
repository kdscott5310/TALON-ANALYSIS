/**
 * Milestone 9B — project draft library.
 *
 * Named saved versions of a project: save/update/rename/duplicate/delete,
 * newest-first ordering ("the latest draft"), snapshot isolation (editing the
 * live project must never mutate a saved draft), persistence with visible
 * recovery, and export round-trip for Git sharing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDraftLibrary,
  saveNewDraft,
  updateDraft,
  renameDraft,
  duplicateDraft,
  deleteDraft,
  draftsByRecency,
  latestDraft,
  findDraft,
  parseDraftLibrary,
  serializeDraftLibrary,
} from '../core/projectDrafts';
import { createCustomProject } from '../core/templates/custom';
import { addNode } from '../core/projectEdits';
import { exportProjectJson, importProjectJson } from '../core/projectSerialization';
import {
  DRAFTS_STORAGE_KEY,
  loadPersistedDrafts,
  persistDrafts,
  useProjectStore,
} from '../state/projectStore';

const T1 = '2026-07-30T10:00:00.000Z';
const T2 = '2026-07-30T11:00:00.000Z';

describe('draft library operations', () => {
  it('saves a named draft and finds it', () => {
    const p = createCustomProject();
    const { library, draftId } = saveNewDraft(createDraftLibrary(), p, { name: 'Baseline', savedOn: T1 });
    expect(library.drafts).toHaveLength(1);
    expect(findDraft(library, draftId)!.name).toBe('Baseline');
  });

  it('snapshots the project — later edits do not mutate a saved draft', () => {
    const p0 = createCustomProject();
    const { library, draftId } = saveNewDraft(createDraftLibrary(), p0, { name: 'Baseline', savedOn: T1 });
    const nodesAtSave = findDraft(library, draftId)!.project.nodes.length;
    // Edit the live project after saving.
    const p1 = addNode(p0, { x: 99, z: 9 }).project;
    expect(p1.nodes.length).toBe(nodesAtSave + 1);
    expect(findDraft(library, draftId)!.project.nodes.length).toBe(nodesAtSave); // snapshot intact
  });

  it('orders newest-first so the latest draft is first', () => {
    const p = createCustomProject();
    let lib = saveNewDraft(createDraftLibrary(), p, { name: 'Older', savedOn: T1 }).library;
    lib = saveNewDraft(lib, p, { name: 'Newer', savedOn: T2 }).library;
    expect(draftsByRecency(lib).map((d) => d.name)).toEqual(['Newer', 'Older']);
    expect(latestDraft(lib)!.name).toBe('Newer');
  });

  it('updates, renames, duplicates and deletes', () => {
    const p0 = createCustomProject();
    let lib = createDraftLibrary();
    const saved = saveNewDraft(lib, p0, { name: 'Baseline', savedOn: T1 });
    lib = saved.library;

    // Update the snapshot with an edited project.
    const p1 = addNode(p0, { x: 5, z: 5 }).project;
    lib = updateDraft(lib, saved.draftId, p1, { savedOn: T2, note: 'added a node' });
    const d = findDraft(lib, saved.draftId)!;
    expect(d.project.nodes.length).toBe(p1.nodes.length);
    expect(d.savedOn).toBe(T2);
    expect(d.note).toBe('added a node');

    lib = renameDraft(lib, saved.draftId, 'Renamed');
    expect(findDraft(lib, saved.draftId)!.name).toBe('Renamed');

    const dup = duplicateDraft(lib, saved.draftId, { savedOn: T2 });
    expect(dup.library.drafts).toHaveLength(2);
    expect(findDraft(dup.library, dup.draftId)!.name).toMatch(/copy/i);

    expect(deleteDraft(dup.library, saved.draftId).drafts).toHaveLength(1);
  });
});

describe('draft library serialization', () => {
  it('round-trips through JSON', () => {
    const lib = saveNewDraft(createDraftLibrary(), createCustomProject(), { name: 'A', savedOn: T1 }).library;
    const parsed = parseDraftLibrary(serializeDraftLibrary(lib));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.library).toEqual(lib);
  });

  it('drops malformed drafts with a disclosed note and rejects unreadable payloads', () => {
    const good = saveNewDraft(createDraftLibrary(), createCustomProject(), { name: 'A', savedOn: T1 }).library;
    const withBad = { ...good, drafts: [...good.drafts, { id: 'x' }] };
    const parsed = parseDraftLibrary(JSON.stringify(withBad));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.library.drafts).toHaveLength(1);
      expect(parsed.notes[0]).toMatch(/dropped saved draft/i);
    }
    expect(parseDraftLibrary('{ bad json').ok).toBe(false);
    expect(parseDraftLibrary(JSON.stringify({ schemaVersion: 99, drafts: [] })).ok).toBe(false);
  });

  it('an exported draft re-imports as a project (the Git sharing path)', () => {
    const lib = saveNewDraft(createDraftLibrary(), createCustomProject(), { name: 'Shared', savedOn: T1 }).library;
    const draft = latestDraft(lib)!;
    const result = importProjectJson(exportProjectJson(draft.project, '1.1.0'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project).toEqual(draft.project);
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

describe('draft persistence', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
  });

  it('persists and reloads drafts', () => {
    const lib = saveNewDraft(createDraftLibrary(), createCustomProject(), { name: 'Kept', savedOn: T1 }).library;
    persistDrafts(lib);
    const loaded = loadPersistedDrafts();
    expect(loaded.library.drafts).toHaveLength(1);
    expect(loaded.library.drafts[0].name).toBe('Kept');
    expect(loaded.notices).toEqual([]);
  });

  it('recovers corrupt draft storage with a visible notice, not a silent default', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(DRAFTS_STORAGE_KEY, 'not json {');
    const loaded = loadPersistedDrafts();
    expect(loaded.library.drafts).toHaveLength(0);
    expect(loaded.notices[0]).toMatch(/discarded/i);
  });
});

describe('store wiring', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
  });

  it('saves the active project as a draft and loads it back', () => {
    const s = () => useProjectStore.getState();
    const startNodes = s().project.nodes.length;
    s().saveDraft('Snapshot A');
    const draftId = s().activeDraftId!;
    expect(draftId).toBeTruthy();

    // Edit the live project, then load the draft back.
    s().setProject(addNode(s().project, { x: 42, z: 4 }).project);
    expect(s().project.nodes.length).toBe(startNodes + 1);
    s().loadDraft(draftId);
    expect(s().project.nodes.length).toBe(startNodes);
    expect(s().notices.join(' ')).toMatch(/loaded draft/i);

    s().deleteDraft(draftId);
    expect(s().drafts.drafts).toHaveLength(0);
  });
});
