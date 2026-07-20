import { useAppStore } from '../state/store';
import { computeLayout } from '../calculations/layoutGeometry';
import { validateScenario } from '../validation/validate';
import { formatLength } from '../units/units';

/**
 * Milestone 1 results placeholder.
 * Shows nominal layout geometry only. Cable tensions, crane loads, anchor
 * reactions, and dynamics arrive in Milestones 2–3.
 */
export function ResultsPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const validation = validateScenario(scenario);

  return (
    <section className="results-panel">
      <h2>Results (preliminary layout)</h2>
      {!validation.isValid ? (
        <p className="blocked">Results withheld — fix input errors first.</p>
      ) : (
        (() => {
          const layout = computeLayout(scenario.site);
          const rows: Array<[string, string]> = [
            ['Main-leg nominal angle', `${layout.mainLegNominalAngleDeg.toFixed(2)}°`],
            ['Backstay nominal angle', `${layout.backstayNominalAngleDeg.toFixed(2)}°`],
            ['Main-leg chord length', formatLength(layout.mainLegChordLengthM, unitSystem)],
            ['Backstay chord length', formatLength(layout.backstayChordLengthM, unitSystem)],
            ['Total site footprint', formatLength(layout.brakeAnchor.x, unitSystem)],
          ];
          return (
            <table>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="num">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()
      )}
      <p className="note">
        Nominal chord geometry is site-layout reference only. Loaded cable
        profiles, tensions, crane loads, and anchor reactions are computed in
        later milestones.
      </p>
    </section>
  );
}
