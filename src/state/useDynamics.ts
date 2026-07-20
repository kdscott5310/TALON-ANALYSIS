/**
 * Shared dynamics-analysis hook.
 *
 * Runs the Milestone-3 simulation once per scenario object (WeakMap
 * memoization) so multiple components can consume the same result
 * without recomputing. Returns null when the scenario is invalid or
 * the solver throws; the throwing error message is preserved.
 */
import { useMemo } from 'react';
import type { Scenario } from '../models/scenario';
import { validateScenario } from '../validation/validate';
import { runDynamicsAnalysis, type DynamicsAnalysisResult } from '../calculations/dynamicsAnalysis';

export interface DynamicsState {
  result: DynamicsAnalysisResult | null;
  /** Solver failure message when result is null but inputs validated */
  error: string | null;
}

const cache = new WeakMap<Scenario, DynamicsState>();

export function computeDynamics(scenario: Scenario): DynamicsState {
  const cached = cache.get(scenario);
  if (cached) return cached;

  let state: DynamicsState;
  if (!validateScenario(scenario).isValid) {
    state = { result: null, error: null };
  } else {
    try {
      state = { result: runDynamicsAnalysis(scenario), error: null };
    } catch (e) {
      state = { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
  cache.set(scenario, state);
  return state;
}

export function useDynamics(scenario: Scenario): DynamicsState {
  return useMemo(() => computeDynamics(scenario), [scenario]);
}
