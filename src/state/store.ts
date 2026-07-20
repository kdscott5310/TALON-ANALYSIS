import { create } from 'zustand';
import type { Scenario } from '../models/scenario';
import { exampleScenario } from '../models/exampleScenario';
import type { UnitSystem } from '../units/units';

interface AppState {
  scenario: Scenario;
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  /** Immutable partial update helper for nested scenario sections. */
  updateScenario: (updater: (s: Scenario) => Scenario) => void;
  resetToExample: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  scenario: exampleScenario,
  unitSystem: 'us',
  setUnitSystem: (u) => set({ unitSystem: u }),
  updateScenario: (updater) => set((state) => ({ scenario: updater(state.scenario) })),
  resetToExample: () => set({ scenario: exampleScenario }),
}));
