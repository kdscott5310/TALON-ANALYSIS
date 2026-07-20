import { create } from 'zustand';
import type { Scenario } from '../models/scenario';
import { exampleScenario } from '../models/exampleScenario';
import type { UnitSystem } from '../units/units';

interface AppState {
  scenario: Scenario;
  unitSystem: UnitSystem;
  /** Trolley position as fraction of main-leg span (0 = at node, 1 = at brake anchor) */
  trolleyPositionFrac: number;
  setUnitSystem: (u: UnitSystem) => void;
  setTrolleyPosition: (frac: number) => void;
  /** Immutable partial update helper for nested scenario sections. */
  updateScenario: (updater: (s: Scenario) => Scenario) => void;
  resetToExample: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  scenario: exampleScenario,
  unitSystem: 'us',
  trolleyPositionFrac: 0.3,
  setUnitSystem: (u) => set({ unitSystem: u }),
  setTrolleyPosition: (frac) => set({ trolleyPositionFrac: Math.max(0, Math.min(1, frac)) }),
  updateScenario: (updater) => set((state) => ({ scenario: updater(state.scenario) })),
  resetToExample: () => set({ scenario: exampleScenario }),
}));
