/**
 * Milestone 5 — benchmark validation regression.
 *
 * The same benchmark cases power the in-app Validation panel, so this
 * guarantees the displayed pass/fail status matches CI.
 */
import { describe, it, expect } from 'vitest';
import { runBenchmarks, benchmarkSummary } from '../calculations/benchmarks';

describe('benchmark validation suite', () => {
  const results = runBenchmarks();

  it('every benchmark passes its documented tolerance', () => {
    const failures = results.filter((r) => !r.pass);
    expect(failures.map((f) => `${f.id}: expected ${f.expected}, got ${f.calculated}`)).toEqual([]);
  });

  it('reports a nonzero set of benchmarks across all categories', () => {
    const summary = benchmarkSummary(results);
    expect(summary.total).toBeGreaterThanOrEqual(14);
    expect(summary.allPass).toBe(true);
    const categories = new Set(results.map((r) => r.category));
    expect(categories).toEqual(
      new Set(['Units', 'Geometry', 'Static cable', 'Equilibrium', 'Anchors', 'Dynamics', 'Braking']),
    );
  });

  it('is deterministic across runs', () => {
    const a = runBenchmarks();
    const b = runBenchmarks();
    expect(a.map((r) => r.calculated)).toEqual(b.map((r) => r.calculated));
  });

  it('every result carries a finite calculated value and an analytical note', () => {
    for (const r of results) {
      expect(Number.isFinite(r.calculated)).toBe(true);
      expect(r.note.length).toBeGreaterThan(10);
      expect(Number.isFinite(r.relError)).toBe(true);
    }
  });
});
