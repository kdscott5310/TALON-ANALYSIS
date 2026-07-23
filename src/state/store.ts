/**
 * Application store — Milestone 4.
 *
 * Holds a library of named scenarios with an active selection,
 * workflow-tab navigation state, and playback state. The scenario
 * library persists to localStorage; corrupt or structurally invalid
 * saved data is dropped with a visible notice (never silently used)
 * and the app recovers with the built-in example.
 */
import { create } from 'zustand';
import type { Scenario } from '../models/scenario';
import { exampleScenario } from '../models/exampleScenario';
import { migrateScenario } from '../models/scenarioSerialization';
import type { UnitSystem } from '../units/units';

export type WorkflowTab = 'setup' | 'static' | 'dynamic' | 'visual3d' | 'compare' | 'report' | 'validation';

export interface StoredScenario {
  id: string;
  scenario: Scenario;
}

const STORAGE_KEY = 'talon-cufts-scenarios-v1';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function cloneScenario(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

interface PersistedShape {
  scenarios: StoredScenario[];
  activeId: string;
}

/** Loads and re-validates persisted scenarios. Invalid entries are dropped with notices. */
function loadPersisted(): { scenarios: StoredScenario[]; activeId: string; notices: string[] } {
  const fallback = () => ({
    scenarios: [{ id: newId(), scenario: cloneScenario(exampleScenario) }],
    activeId: '',
    notices: [] as string[],
  });

  if (typeof localStorage === 'undefined') return { ...fallback(), activeId: '' };

  const notices: string[] = [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return fallback();
  }
  if (!raw) return fallback();

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    if (!Array.isArray(parsed.scenarios)) throw new Error('missing scenarios array');
    const scenarios: StoredScenario[] = [];
    for (const entry of parsed.scenarios) {
      if (!entry || typeof entry.id !== 'string') {
        notices.push('Recovered storage: dropped a saved entry with no id.');
        continue;
      }
      const result = migrateScenario(entry.scenario);
      if (result.ok) {
        scenarios.push({ id: entry.id, scenario: result.scenario });
        for (const note of result.migrationNotes) notices.push(`"${result.scenario.name}": ${note}`);
      } else {
        notices.push(
          `Recovered storage: dropped saved scenario with invalid data (${result.errors[0] ?? 'unknown error'}).`,
        );
      }
    }
    if (scenarios.length === 0) {
      notices.push('No valid saved scenarios found — loaded the built-in example.');
      return { ...fallback(), notices };
    }
    const activeId =
      typeof parsed.activeId === 'string' && scenarios.some((s) => s.id === parsed.activeId)
        ? parsed.activeId
        : scenarios[0].id;
    return { scenarios, activeId, notices };
  } catch (e) {
    notices.push(
      `Saved scenario data was corrupt and has been discarded (${e instanceof Error ? e.message : 'parse error'}). Loaded the built-in example.`,
    );
    return { ...fallback(), notices };
  }
}

function persist(scenarios: StoredScenario[], activeId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload: PersistedShape = { scenarios, activeId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable — the session continues unpersisted.
  }
}

interface AppState {
  scenarios: StoredScenario[];
  activeId: string;
  /** Active scenario object (same reference as its library entry). */
  scenario: Scenario;
  /** Scenario ids selected for the comparison view. */
  compareIds: string[];
  activeTab: WorkflowTab;
  unitSystem: UnitSystem;
  trolleyPositionFrac: number;
  simTimeS: number;
  /** Storage-recovery and migration notices for display. */
  notices: string[];

  setActiveTab: (t: WorkflowTab) => void;
  setUnitSystem: (u: UnitSystem) => void;
  setTrolleyPosition: (frac: number) => void;
  setSimTime: (t: number) => void;

  setActiveScenario: (id: string) => void;
  createScenario: () => void;
  duplicateScenario: (id: string) => void;
  renameScenario: (id: string, name: string) => void;
  deleteScenario: (id: string) => void;
  /** Adds an imported scenario to the library and activates it. */
  addImportedScenario: (scenario: Scenario, notes: string[]) => void;
  toggleCompare: (id: string) => void;
  dismissNotices: () => void;

  /** Immutable partial update helper for the ACTIVE scenario. */
  updateScenario: (updater: (s: Scenario) => Scenario) => void;
  resetToExample: () => void;
}

const initial = loadPersisted();
const initialActiveId = initial.activeId || initial.scenarios[0].id;

export const useAppStore = create<AppState>((set, get) => {
  /** Applies a library mutation, keeps `scenario` coherent, persists. */
  function commit(scenarios: StoredScenario[], activeId: string, extra?: Partial<AppState>): void {
    const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
    persist(scenarios, active.id);
    set({ scenarios, activeId: active.id, scenario: active.scenario, simTimeS: 0, ...extra });
  }

  return {
    scenarios: initial.scenarios,
    activeId: initialActiveId,
    scenario: initial.scenarios.find((s) => s.id === initialActiveId)!.scenario,
    compareIds: initial.scenarios.map((s) => s.id),
    activeTab: 'setup',
    unitSystem: 'us',
    trolleyPositionFrac: 0.3,
    simTimeS: 0,
    notices: initial.notices,

    setActiveTab: (t) => set({ activeTab: t }),
    setUnitSystem: (u) => set({ unitSystem: u }),
    setTrolleyPosition: (frac) => set({ trolleyPositionFrac: Math.max(0, Math.min(1, frac)) }),
    setSimTime: (t) => set({ simTimeS: Math.max(0, t) }),

    setActiveScenario: (id) => {
      const { scenarios } = get();
      if (scenarios.some((s) => s.id === id)) commit(scenarios, id);
    },

    createScenario: () => {
      const { scenarios, compareIds } = get();
      const scenario = cloneScenario(exampleScenario);
      scenario.name = `New scenario ${scenarios.length + 1}`;
      const entry = { id: newId(), scenario };
      commit([...scenarios, entry], entry.id, { compareIds: [...compareIds, entry.id] });
    },

    duplicateScenario: (id) => {
      const { scenarios, compareIds } = get();
      const src = scenarios.find((s) => s.id === id);
      if (!src) return;
      const scenario = cloneScenario(src.scenario);
      scenario.name = `${src.scenario.name} (copy)`;
      const entry = { id: newId(), scenario };
      commit([...scenarios, entry], entry.id, { compareIds: [...compareIds, entry.id] });
    },

    renameScenario: (id, name) => {
      const { scenarios, activeId } = get();
      const trimmed = name.trim();
      if (!trimmed) return;
      const next = scenarios.map((s) =>
        s.id === id ? { ...s, scenario: { ...s.scenario, name: trimmed } } : s,
      );
      commit(next, activeId);
    },

    deleteScenario: (id) => {
      const { scenarios, activeId, compareIds } = get();
      let next = scenarios.filter((s) => s.id !== id);
      if (next.length === 0) {
        next = [{ id: newId(), scenario: cloneScenario(exampleScenario) }];
      }
      const nextActive = id === activeId ? next[0].id : activeId;
      commit(next, nextActive, { compareIds: compareIds.filter((c) => c !== id) });
    },

    addImportedScenario: (scenario, notes) => {
      const { scenarios, notices, compareIds } = get();
      const entry = { id: newId(), scenario };
      commit([...scenarios, entry], entry.id, {
        compareIds: [...compareIds, entry.id],
        notices: [...notices, ...notes.map((n) => `Import "${scenario.name}": ${n}`)],
      });
    },

    toggleCompare: (id) =>
      set((state) => ({
        compareIds: state.compareIds.includes(id)
          ? state.compareIds.filter((c) => c !== id)
          : [...state.compareIds, id],
      })),

    dismissNotices: () => set({ notices: [] }),

    updateScenario: (updater) => {
      const { scenarios, activeId } = get();
      const next = scenarios.map((s) =>
        s.id === activeId ? { ...s, scenario: updater(s.scenario) } : s,
      );
      commit(next, activeId);
    },

    resetToExample: () => {
      const { scenarios, activeId } = get();
      const next = scenarios.map((s) =>
        s.id === activeId ? { ...s, scenario: cloneScenario(exampleScenario) } : s,
      );
      commit(next, activeId);
    },
  };
});
