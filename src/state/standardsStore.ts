/**
 * Standards store — Milestone 9A.
 *
 * Holds the active engineering-standards document, persisted under its own
 * localStorage key. Seeds the starter template on first run and persists through
 * the validated `standardsIo` path, so corrupt saved data is re-validated on
 * load and dropped with a visible notice — never a silent default (Rule 10).
 */
import { create } from 'zustand';
import { createDefaultStandards, type Standards } from '../core/standards';
import { exportStandardsJson, importStandardsJson } from '../core/standardsIo';
import { APP_VERSION } from '../version';

export const STANDARDS_STORAGE_KEY = 'talon-standards-v1';

export interface LoadedStandards {
  standards: Standards;
  notices: string[];
  seeded: boolean;
}

export function loadPersistedStandards(): LoadedStandards {
  const seed = (notices: string[] = []): LoadedStandards => ({
    standards: createDefaultStandards(),
    notices,
    seeded: true,
  });
  if (typeof localStorage === 'undefined') return seed();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STANDARDS_STORAGE_KEY);
  } catch {
    return seed();
  }
  if (!raw) return seed();
  const result = importStandardsJson(raw);
  if (result.ok) return { standards: result.standards, notices: [], seeded: false };
  return seed([
    `Saved standards data was invalid and has been discarded (${
      result.errors[0] ?? 'unknown error'
    }). Loaded the starter template.`,
  ]);
}

export function persistStandards(standards: Standards): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STANDARDS_STORAGE_KEY, exportStandardsJson(standards, APP_VERSION));
  } catch {
    // Storage full or unavailable — the session continues unpersisted.
  }
}

interface StandardsStoreState {
  standards: Standards;
  notices: string[];
  /** Replaces the standards (edits, imports) and persists. Stamps updatedOn. */
  setStandards: (standards: Standards, notes?: string[]) => void;
  resetToStarter: () => void;
  dismissNotices: () => void;
}

const initial = loadPersistedStandards();
if (initial.seeded) persistStandards(initial.standards);

export const useStandardsStore = create<StandardsStoreState>((set) => ({
  standards: initial.standards,
  notices: initial.notices,

  setStandards: (standards, notes = []) => {
    // Stamp the edit time; the human `revision` field is user-managed.
    const stamped: Standards = { ...standards, updatedOn: new Date().toISOString() };
    persistStandards(stamped);
    set({ standards: stamped, notices: notes });
  },

  resetToStarter: () => {
    const standards = createDefaultStandards();
    persistStandards(standards);
    set({ standards, notices: [] });
  },

  dismissNotices: () => set({ notices: [] }),
}));
