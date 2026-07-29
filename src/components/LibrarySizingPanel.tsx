/**
 * Component sizing & candidate selection — Milestone 7D.
 *
 * Feeds a calculated demand into the built-and-tested sizing engine
 * (`calculations/componentSizing.ts`) and presents EVERY candidate — passing,
 * failing, insufficient, or excluded — with its published rating, derated
 * rating, utilization, controlling criterion, verification state, and reason.
 * It never auto-selects the smallest passing part; the engine does all the math
 * (Rules 2/7). A missing rating is insufficient information, never adequate
 * (Rule 3); the published and derated ratings are shown separately (Rule 5).
 */
import { useMemo, useState } from 'react';
import { useLibraryStore } from '../state/libraryStore';
import { useAppStore } from '../state/store';
import {
  sizeComponent,
  type Candidate,
  type SizingResult,
} from '../calculations/componentSizing';
import type { ComponentCategory } from '../core/model';
import { formatForce, fromDisplayValue } from '../units/units';

/** Force-valued rating keys the seed/library records commonly carry. */
const RATING_KEYS = [
  'minimumBreakingStrength',
  'workingLoadLimit',
  'ratedCapacity',
  'proofLoad',
  'forceCapacity',
];

const STATUS_CLASS: Record<Candidate['status'], string> = {
  pass: 'st-ok',
  fail: 'st-failed',
  insufficientInformation: 'st-insufficient',
  excludedUnverified: 'st-caution',
  excludedObsolete: 'st-caution',
};

export function LibrarySizingPanel() {
  const library = useLibraryStore((s) => s.library);
  const unitSystem = useAppStore((s) => s.unitSystem);

  const categories = useMemo(
    () => Array.from(new Set(library.records.map((r) => r.category))).sort(),
    [library.records],
  );

  const [label, setLabel] = useState('Main line tension');
  const [category, setCategory] = useState<ComponentCategory>(categories[0] ?? 'syntheticRope');
  const [ratingKey, setRatingKey] = useState('minimumBreakingStrength');
  const [demandStr, setDemandStr] = useState('10000');
  const [designFactor, setDesignFactor] = useState('5');
  const [deratingStr, setDeratingStr] = useState('1');
  const [requireVerified, setRequireVerified] = useState(false);
  const [result, setResult] = useState<SizingResult | null>(null);

  const run = () => {
    const demandDisp = Number(demandStr);
    const df = Number(designFactor);
    const der = Number(deratingStr);
    if (!Number.isFinite(demandDisp) || !Number.isFinite(df)) return;
    const deratings = Number.isFinite(der) && der > 0 && der < 1 ? { applied: der } : undefined;
    setResult(
      sizeComponent(library, {
        label: label.trim() || 'Demand',
        category,
        ratingKey,
        demand: fromDisplayValue(demandDisp, 'force', unitSystem),
        designFactor: df,
        deratings,
        requireVerified,
      }),
    );
  };

  const fmt = (n: number | null) => (n === null ? '—' : formatForce(n, unitSystem));

  return (
    <section className="results-panel no-print">
      <h2>Component sizing</h2>
      <div className="inspector-actions inspector-create">
        <label className="inspector-field">Demand label<input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="inspector-field">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as ComponentCategory)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="inspector-field">
          Rating property
          <select value={ratingKey} onChange={(e) => setRatingKey(e.target.value)}>
            {RATING_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="inspector-field">Demand ({unitSystem === 'us' ? 'lbf' : 'N'})<input type="number" value={demandStr} onChange={(e) => setDemandStr(e.target.value)} /></label>
        <label className="inspector-field">Design factor<input type="number" value={designFactor} onChange={(e) => setDesignFactor(e.target.value)} /></label>
        <label className="inspector-field">Derating (×, 0–1)<input type="number" value={deratingStr} onChange={(e) => setDeratingStr(e.target.value)} /></label>
        <label className="inspector-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={requireVerified} onChange={(e) => setRequireVerified(e.target.checked)} />
          require verified
        </label>
        <button type="button" onClick={run}>Size component</button>
      </div>
      <p className="note">
        Every candidate is shown; TALON never auto-selects the smallest passing part.
        Published and derated ratings are separate; a missing rating is insufficient
        information, never adequate.
      </p>

      {result && (
        <>
          <p className="note">
            Required rating for “{result.demandLabel}”: <strong>{formatForce(result.requiredRating, unitSystem)}</strong>{' '}
            (demand × design factor) · {result.passing.length} passing of {result.allCandidates.length} candidates.
          </p>
          {result.allCandidates.length === 0 ? (
            <p className="note">No components in this category — a procurement search is needed (7E).</p>
          ) : (
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Candidate</th><th>Status</th><th>Published</th><th>Derated</th>
                    <th>Utilization</th><th>Margin</th><th>Verification</th><th>Controlling</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allCandidates.map((c) => (
                    <tr key={c.recordId}>
                      <td>{c.name}{c.partNumber ? ` (${c.partNumber})` : ''}</td>
                      <td><span className={STATUS_CLASS[c.status]}>{c.status}</span></td>
                      <td>{fmt(c.publishedRating)}</td>
                      <td>{fmt(c.deratedRating)}</td>
                      <td>{c.utilization === null ? '—' : `${(c.utilization * 100).toFixed(0)}%`}</td>
                      <td>{c.margin === null ? '—' : `${c.margin.toFixed(2)}×`}</td>
                      <td className="cell-status">{c.verificationState}</td>
                      <td className="cell-note">{c.controllingCriterion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="warnings-panel">
              <ul>{result.warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
