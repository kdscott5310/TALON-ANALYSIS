/**
 * Component-library store — Milestone 7A.
 *
 * A Zustand store over the built-and-tested component library
 * (`core/library`), mounted beside the project and v1 scenario stores under its
 * own localStorage key. It seeds the EXAMPLE-ONLY library on first run and
 * persists through the validated `libraryIo` path, so corrupt or hand-edited
 * saved data is re-validated on load and dropped with a VISIBLE notice — never
 * a silent default (Rule 10). Contains no engineering math (Rules 2/7).
 *
 * 7A is browse-only; record/property editing (7B) and import/export + source
 * adapters (7C) arrive next.
 */
import { create } from 'zustand';
import type { ComponentLibrary } from '../core/library/componentLibrary';
import { buildSeedLibrary } from '../core/library/seedLibrary';
import { exportLibraryJson, importLibraryJson } from '../core/library/libraryIo';
import { APP_VERSION } from '../version';

/** Dedicated key — must not collide with the project or v1 scenario keys. */
export const LIBRARY_STORAGE_KEY = 'talon-library-v1';

export function seedLibraryState(): ComponentLibrary {
  return buildSeedLibrary();
}

export interface LoadedLibrary {
  library: ComponentLibrary;
  notices: string[];
  seeded: boolean;
}

export function loadPersistedLibrary(): LoadedLibrary {
  const seed = (notices: string[] = []): LoadedLibrary => ({
    library: seedLibraryState(),
    notices,
    seeded: true,
  });

  if (typeof localStorage === 'undefined') return seed();

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
  } catch {
    return seed();
  }
  if (!raw) return seed();

  const result = importLibraryJson(raw);
  if (result.ok) {
    return {
      library: result.library,
      notices: result.notes.map((n) => `Library: ${n}`),
      seeded: false,
    };
  }
  return seed([
    `Saved component-library data was invalid and has been discarded (${
      result.errors[0] ?? 'unknown error'
    }). Loaded the built-in example library.`,
  ]);
}

export function persistLibrary(library: ComponentLibrary): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, exportLibraryJson(library, APP_VERSION));
  } catch {
    // Storage full or unavailable — the session continues without persistence.
  }
}

interface LibraryStoreState {
  library: ComponentLibrary;
  notices: string[];
  /** Replaces the library and persists it (used by import/editing packages). */
  setLibrary: (library: ComponentLibrary, notes?: string[]) => void;
  /** Re-seeds the built-in EXAMPLE-ONLY library. */
  resetToSeedLibrary: () => void;
  dismissNotices: () => void;
}

const initial = loadPersistedLibrary();
if (initial.seeded) persistLibrary(initial.library);

export const useLibraryStore = create<LibraryStoreState>((set) => ({
  library: initial.library,
  notices: initial.notices,

  setLibrary: (library, notes = []) => {
    persistLibrary(library);
    set({ library, notices: notes });
  },

  resetToSeedLibrary: () => {
    const library = seedLibraryState();
    persistLibrary(library);
    set({ library, notices: [] });
  },

  dismissNotices: () => set({ notices: [] }),
}));
