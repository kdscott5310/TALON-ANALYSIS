/**
 * Project store — Milestone 6A.
 *
 * A `Project`-model-backed store mounted BESIDE the v1 scenario store
 * (`state/store.ts`), never replacing it. It holds one generalized
 * `core/model.ts` Project, seeded from the CUFTS fixture template, and
 * persists it under its own localStorage key so the two stores never collide.
 *
 * Persistence reuses the tested serialization/validation path
 * (`core/projectSerialization.ts`): saving is `exportProjectJson`, loading is
 * `importProjectJson`. That means corrupt or hand-edited saved data is
 * re-validated on load and dropped with a VISIBLE notice — never silently
 * defaulted (Rule 10) and never coerced to zero (Rule 4).
 *
 * Scope note (6A): this is the runtime foundation for the fixture editor. It
 * holds and persists a Project and exposes a minimal, immutable replace; the
 * graphical editing, template picker, and solver wiring arrive in 6B+.
 * This module contains no engineering math (Rules 2/7).
 */
import { create } from 'zustand';
import type { Project } from '../core/model';
// Importing the templates registers their builders with the registry.
import { buildCuftsProject } from '../core/templates/cufts';
import '../core/templates/custom';
import { instantiateTemplate, type FixtureTemplateId } from '../core/templates/registry';
import {
  exportProjectJson as serializeProject,
  importProjectJson as parseProjectJson,
} from '../core/projectSerialization';
import { exampleScenario } from '../models/exampleScenario';
import { APP_VERSION } from '../version';

/** Dedicated key — must not collide with the v1 scenario store key. */
export const PROJECT_STORAGE_KEY = 'talon-project-v1';

/** Builds a fresh CUFTS project from the built-in unverified example scenario. */
export function seedExampleProject(): Project {
  return buildCuftsProject(exampleScenario);
}

/**
 * Instantiates a project from an implemented fixture template (6B).
 *
 * The registry refuses any template that is not implemented — it throws rather
 * than fabricating a fixture TALON cannot build (Rule 8/11). Only CUFTS is
 * implemented in this build, and it is seeded from the v1 example scenario;
 * `instantiateTemplate` never reaches the builder for a planned template.
 */
export function newProjectFromTemplate(id: FixtureTemplateId): Project {
  return instantiateTemplate(id, exampleScenario);
}

export interface LoadedProject {
  project: Project;
  /** Recovery/migration notices to surface to the user. */
  notices: string[];
  /** True when the built-in example was used (empty or invalid storage). */
  seeded: boolean;
}

/**
 * Loads the persisted project, re-validating it through the import path.
 * Empty storage seeds the CUFTS example; invalid storage recovers to the
 * CUFTS example WITH a visible notice.
 */
export function loadPersistedProject(): LoadedProject {
  const seed = (notices: string[] = []): LoadedProject => ({
    project: seedExampleProject(),
    notices,
    seeded: true,
  });

  if (typeof localStorage === 'undefined') return seed();

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PROJECT_STORAGE_KEY);
  } catch {
    return seed();
  }
  if (!raw) return seed();

  const result = parseProjectJson(raw);
  if (result.ok) {
    return {
      project: result.project,
      notices: result.migrationNotes.map((n) => `Project: ${n}`),
      seeded: false,
    };
  }
  return seed([
    `Saved project data was invalid and has been discarded (${
      result.errors[0] ?? 'unknown error'
    }). Loaded the built-in CUFTS example.`,
  ]);
}

/** Serializes and stores the project. Storage failures leave the session unpersisted. */
export function persistProject(project: Project): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, serializeProject(project, APP_VERSION));
  } catch {
    // Storage full or unavailable — the session continues without persistence.
  }
}

interface ProjectStoreState {
  /** The single active generalized project. */
  project: Project;
  /** Storage-recovery / migration notices for display. */
  notices: string[];

  /** Immutably replaces the active project and persists it. */
  setProject: (project: Project) => void;
  /** Creates a new project from an implemented fixture template (6B). */
  createFromTemplate: (id: FixtureTemplateId) => void;
  /** Re-seeds the built-in CUFTS example project. */
  resetToExampleProject: () => void;
  /** Serializes the active project to a downloadable JSON string. */
  toProjectJson: () => string;
  dismissNotices: () => void;
}

const initial = loadPersistedProject();
// Persist a freshly seeded project so a page refresh reloads the same one.
if (initial.seeded) persistProject(initial.project);

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: initial.project,
  notices: initial.notices,

  setProject: (project) => {
    persistProject(project);
    set({ project });
  },

  createFromTemplate: (id) => {
    const project = newProjectFromTemplate(id);
    persistProject(project);
    set({ project, notices: [] });
  },

  resetToExampleProject: () => {
    const project = seedExampleProject();
    persistProject(project);
    set({ project, notices: [] });
  },

  toProjectJson: () => serializeProject(get().project, APP_VERSION),

  dismissNotices: () => set({ notices: [] }),
}));
