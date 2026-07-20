import { useAppStore } from '../state/store';
import { validateScenario } from '../validation/validate';

export function WarningsPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const result = validateScenario(scenario);

  return (
    <section className="warnings-panel">
      <h2>Validation &amp; warnings</h2>
      {result.issues.length === 0 && <p className="ok">No validation issues.</p>}
      <ul>
        {result.issues.map((i, idx) => (
          <li key={idx} className={i.severity}>
            <strong>{i.severity === 'error' ? 'ERROR' : 'Warning'}:</strong> {i.message}
            <span className="issue-field"> ({i.field})</span>
          </li>
        ))}
      </ul>
      {!result.isValid && (
        <p className="blocked">
          Errors above must be corrected; invalid values are excluded from calculations.
        </p>
      )}
    </section>
  );
}
