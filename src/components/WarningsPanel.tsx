import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { validateScenario } from '../validation/validate';
import { runStaticAnalysis } from '../calculations/staticAnalysis';

export function WarningsPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const trolleyPos = useAppStore((s) => s.trolleyPositionFrac);
  const validationResult = validateScenario(scenario);

  const solverWarnings: string[] = useMemo(() => {
    if (!validationResult.isValid) return [];
    try {
      const r = runStaticAnalysis({ scenario, trolleyPositionFrac: trolleyPos });
      return r.allWarnings;
    } catch (e) {
      return [`Solver error: ${e instanceof Error ? e.message : String(e)}`];
    }
  }, [scenario, trolleyPos, validationResult.isValid]);

  const hasAny = validationResult.issues.length > 0 || solverWarnings.length > 0;

  return (
    <section className="warnings-panel">
      <h2>Validation &amp; warnings</h2>
      {!hasAny && <p className="ok">No validation issues.</p>}

      {validationResult.issues.length > 0 && (
        <ul>
          {validationResult.issues.map((i, idx) => (
            <li key={`v-${idx}`} className={i.severity}>
              <strong>{i.severity === 'error' ? 'ERROR' : 'Warning'}:</strong> {i.message}
              <span className="issue-field"> ({i.field})</span>
            </li>
          ))}
        </ul>
      )}

      {solverWarnings.length > 0 && (
        <>
          <h3 className="solver-warn-heading">Solver warnings</h3>
          <ul>
            {solverWarnings.map((w, idx) => (
              <li key={`s-${idx}`} className="warning">{w}</li>
            ))}
          </ul>
        </>
      )}

      {!validationResult.isValid && (
        <p className="blocked">
          Errors above must be corrected; invalid values are excluded from calculations.
        </p>
      )}
    </section>
  );
}
