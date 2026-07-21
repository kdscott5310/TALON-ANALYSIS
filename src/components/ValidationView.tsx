import { useMemo } from 'react';
import { runBenchmarks, benchmarkSummary, type BenchmarkResult, type BenchmarkCategory } from '../calculations/benchmarks';

/**
 * Validation panel — Milestone 5.
 *
 * Runs the independent benchmark suite (hand-calculable cases) and
 * shows expected vs calculated, tolerance, and pass/fail. These are
 * the same cases verified in CI (`benchmarks.test.ts`).
 */

const CATEGORY_ORDER: BenchmarkCategory[] = [
  'Units',
  'Geometry',
  'Static cable',
  'Equilibrium',
  'Anchors',
  'Dynamics',
  'Braking',
];

function fmt(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e4 || abs < 1e-3) return n.toExponential(4);
  return n.toFixed(4);
}

export function ValidationView() {
  const results = useMemo(() => runBenchmarks(), []);
  const summary = benchmarkSummary(results);

  const byCategory = new Map<BenchmarkCategory, BenchmarkResult[]>();
  for (const r of results) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }

  return (
    <div className="single-col">
      <section className="results-panel">
        <h2>Benchmark validation</h2>
        <p className={summary.allPass ? 'ok' : 'blocked'}>
          {summary.passed} / {summary.total} benchmarks pass
          {summary.allPass
            ? ' — all solver results match their analytical hand calculations.'
            : ` — ${summary.failed} FAILED (see highlighted rows).`}
        </p>
        <p className="note">
          Each case compares a solver output against a closed-form expected value derived
          independently (shown in “Analytical basis”). These same cases run in continuous
          integration, so the status here matches the test suite. Passing benchmarks verify the
          numerical kernel — they do <strong>not</strong> certify the models against real hardware,
          which still requires professional validation.
        </p>

        <table className="benchmark-table">
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Expected</th>
              <th scope="col">Calculated</th>
              <th scope="col">Rel. error</th>
              <th scope="col">Tolerance</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
              <CategoryRows key={cat} category={cat} rows={byCategory.get(cat)!} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CategoryRows({ category, rows }: { category: BenchmarkCategory; rows: BenchmarkResult[] }) {
  return (
    <>
      <tr className="benchmark-cat">
        <td colSpan={6}>{category}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id} className={r.pass ? '' : 'st-failed'}>
          <td>
            {r.name}
            <div className="benchmark-note">{r.note}</div>
          </td>
          <td className="num">
            {fmt(r.expected)} {r.unit !== '—' ? r.unit : ''}
          </td>
          <td className="num">
            {fmt(r.calculated)} {r.unit !== '—' ? r.unit : ''}
          </td>
          <td className="num">{(r.relError * 100).toExponential(2)}%</td>
          <td className="num">{(r.tolerance * 100).toExponential(1)}%</td>
          <td className={r.pass ? 'st-ok' : 'st-failed'}>{r.pass ? 'PASS' : 'FAIL'}</td>
        </tr>
      ))}
    </>
  );
}
