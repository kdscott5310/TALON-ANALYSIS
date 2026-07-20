import { useAppStore } from '../state/store';
import type { ScenarioSummary } from '../calculations/statusSummary';
import { computeSummary } from '../state/useSummary';
import { formatItemValue, STATUS_LABEL } from './formatSummary';

/**
 * Scenario comparison — key geometry, loads, margins, speed, braking,
 * and warnings for the selected scenarios, side by side with status
 * coloring. Each cell's tooltip carries solver and assumption
 * traceability.
 */
export function CompareView() {
  const scenarios = useAppStore((s) => s.scenarios);
  const compareIds = useAppStore((s) => s.compareIds);
  const toggleCompare = useAppStore((s) => s.toggleCompare);
  const unitSystem = useAppStore((s) => s.unitSystem);

  const selected = scenarios.filter((s) => compareIds.includes(s.id));

  // computeSummary is WeakMap-memoized per scenario object, so this is
  // cheap on re-render and recomputes only when a scenario changes.
  const summaries = new Map(selected.map((s) => [s.id, computeSummary(s.scenario)] as const));

  // Union of item keys across scenarios, in first-seen order.
  const rowKeys: { key: string; label: string }[] = [];
  for (const s of selected) {
    const sum = summaries.get(s.id);
    if (!sum) continue;
    for (const item of sum.items) {
      if (!rowKeys.some((r) => r.key === item.key)) rowKeys.push({ key: item.key, label: item.label });
    }
  }

  return (
    <div className="compare-view">
      <section className="results-panel">
        <h2>Select scenarios to compare</h2>
        <ul className="compare-select">
          {scenarios.map((s) => (
            <li key={s.id}>
              <label>
                <input
                  type="checkbox"
                  checked={compareIds.includes(s.id)}
                  onChange={() => toggleCompare(s.id)}
                />{' '}
                {s.scenario.name}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {selected.length === 0 ? (
        <section className="results-panel">
          <p className="note">
            No scenarios selected. Tick at least one scenario above to build the comparison table.
          </p>
        </section>
      ) : (
        <section className="results-panel compare-table-wrap">
          <h2>Comparison ({selected.length} scenario{selected.length === 1 ? '' : 's'})</h2>
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">Check</th>
                {selected.map((s) => (
                  <th scope="col" key={s.id}>{s.scenario.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="overall-row">
                <td>Overall status</td>
                {selected.map((s) => {
                  const sum = summaries.get(s.id)!;
                  return (
                    <td key={s.id} className={`st-${sum.overall}`}>
                      {STATUS_LABEL[sum.overall]}
                      {sum.solverError && <div className="cell-note">{sum.solverError}</div>}
                    </td>
                  );
                })}
              </tr>
              {rowKeys.map((rk) => (
                <tr key={rk.key}>
                  <td>{rk.label}</td>
                  {selected.map((s) => {
                    const sum = summaries.get(s.id)!;
                    const item = sum.items.find((i) => i.key === rk.key);
                    if (!item) return <td key={s.id}>—</td>;
                    return (
                      <td
                        key={s.id}
                        className={`st-${item.status}`}
                        title={`${item.detail}\nSolver: ${item.solver}\nInputs: ${item.inputs}\nAssumptions: ${item.assumptions}`}
                      >
                        {formatItemValue(item, unitSystem)}
                        <span className="cell-status"> · {STATUS_LABEL[item.status]}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td>Validation issues</td>
                {selected.map((s) => {
                  const sum = summaries.get(s.id)!;
                  return (
                    <td key={s.id}>
                      {sum.validationErrorCount} errors, {sum.validationWarningCount} warnings
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td>Critical warnings</td>
                {selected.map((s) => {
                  const sum = summaries.get(s.id)!;
                  return (
                    <td key={s.id} className={sum.criticalWarnings.length > 0 ? 'st-failed' : ''}>
                      {sum.criticalWarnings.length === 0 ? 'none' : (
                        <ul className="cell-warnings">
                          {sum.criticalWarnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
          <p className="note">
            Hover a cell for the limit, solver, inputs, and assumptions behind each value. Static
            peaks are swept over trolley positions; dynamic values come from the RK4 simulation.
            All results are preliminary and require professional verification.
          </p>
        </section>
      )}
    </div>
  );
}

export type { ScenarioSummary };
