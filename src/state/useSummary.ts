/**
 * WeakMap-memoized scenario status summaries: the sweep + simulation
 * run once per scenario object, shared by Compare and Report views.
 */
import type { Scenario } from '../models/scenario';
import { summarizeScenario, type ScenarioSummary } from '../calculations/statusSummary';

const cache = new WeakMap<Scenario, ScenarioSummary>();

export function computeSummary(scenario: Scenario): ScenarioSummary {
  const cached = cache.get(scenario);
  if (cached) return cached;
  const summary = summarizeScenario(scenario);
  cache.set(scenario, summary);
  return summary;
}
