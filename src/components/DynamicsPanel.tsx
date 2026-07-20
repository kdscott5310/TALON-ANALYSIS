import { useAppStore } from '../state/store';
import { useDynamics } from '../state/useDynamics';
import { validateScenario } from '../validation/validate';
import { formatEnergy, formatForce, formatLength, formatSpeed, GRAVITY } from '../units/units';

/**
 * Milestone-3 results card: simulation outcome, peaks vs user-entered
 * limits, stopping performance, and the energy audit.
 */
export function DynamicsPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const { result, error } = useDynamics(scenario);
  const validation = validateScenario(scenario);

  if (!validation.isValid) {
    return (
      <section className="results-panel">
        <h2>Dynamics &amp; Braking</h2>
        <p className="blocked">Simulation withheld — fix input errors first.</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="results-panel">
        <h2>Dynamics &amp; Braking</h2>
        <p className="blocked">Simulation error: {error}</p>
      </section>
    );
  }
  if (!result) return null;

  const { sim } = result;
  const fmtL = (m: number) => formatLength(m, unitSystem, 1);
  const fmtF = (n: number) => formatForce(n, unitSystem, 0);
  const fmtV = (v: number) => formatSpeed(v, unitSystem, 1);
  const fmtE = (j: number) => formatEnergy(j, unitSystem, 0);

  const terminationLabel: Record<string, string> = {
    'stopped-in-brake-zone': 'Stopped in brake zone',
    'stalled-before-brake': 'STALLED before brake zone',
    'end-of-path': 'OVERRAN end of path',
    'time-limit': 'Time limit reached (non-convergent)',
    'numerical-error': 'NUMERICAL ERROR',
  };
  const terminationOk = sim.termination === 'stopped-in-brake-zone';

  return (
    <section className="results-panel">
      <h2>Dynamics &amp; Braking</h2>

      <details open>
        <summary>Run outcome</summary>
        <table><tbody>
          <Row k="Termination" v={terminationLabel[sim.termination]} warn={!terminationOk} />
          <Row k="Total run time" v={`${sim.finalTimeS.toFixed(2)} s`} />
          <Row k="Peak speed" v={`${fmtV(sim.peakSpeedMps)} @ x = ${fmtL(sim.peakSpeedAtXM)}`}
            warn={sim.peakSpeedMps > scenario.trolley.maxAllowableSpeedMps} />
          <Row k="Brake-entry time" v={sim.brakeEntryTimeS !== null ? `${sim.brakeEntryTimeS.toFixed(2)} s` : '—'} />
          <Row k="Brake-entry speed" v={sim.brakeEntrySpeedMps !== null ? fmtV(sim.brakeEntrySpeedMps) : '—'} />
        </tbody></table>
      </details>

      <details open>
        <summary>Stopping performance</summary>
        <table><tbody>
          <Row k="Stroke used" v={sim.strokeUsedM !== null ? fmtL(sim.strokeUsedM) : '—'}
            warn={sim.strokeUsedM !== null && sim.strokeUsedM > scenario.brake.availableStrokeM} />
          <Row k="Stroke available" v={fmtL(scenario.brake.availableStrokeM)} />
          <Row k="Residual speed" v={fmtV(sim.residualSpeedMps)} warn={sim.residualSpeedMps > 0.1} />
          <Row k="Peak deceleration" v={`${result.peakDecelG.toFixed(2)} g`}
            warn={sim.peakDecelMps2 > scenario.brake.maxDecelerationMps2} />
          <Row k="Allowable deceleration" v={`${(scenario.brake.maxDecelerationMps2 / GRAVITY).toFixed(2)} g`} />
          <Row k="Peak brake force" v={fmtF(sim.peakBrakeForceN)}
            warn={scenario.brake.brakeCapacityN > 0 && sim.peakBrakeForceN > scenario.brake.brakeCapacityN} />
          <Row k="Peak brake force × DAF" v={fmtF(result.dafAmplifiedBrakeForceN)} />
        </tbody></table>
        <p className="note">
          Brake law: <strong>{scenario.brake.brakeLaw}</strong> (idealized preliminary law).
          DAF demand is preliminary; coupled cable–brake transients are a later milestone.
        </p>
      </details>

      <details open>
        <summary>Energy audit</summary>
        <table><tbody>
          <Row k="Potential released" v={fmtE(sim.energy.potentialReleasedJ)} />
          <Row k="Kinetic at release" v={fmtE(sim.energy.initialKineticJ)} />
          <Row k="Kinetic at brake entry" v={sim.brakeEntryKineticJ !== null ? fmtE(sim.brakeEntryKineticJ) : '—'} />
          <Row k="Potential through brake zone" v={sim.brakeZonePotentialJ !== null ? fmtE(sim.brakeZonePotentialJ) : '—'} />
          <Row k="Brake work absorbed" v={fmtE(sim.energy.brakeWorkJ)} />
          <Row k="Aerodynamic loss" v={fmtE(sim.energy.dragWorkJ)} />
          <Row k="Rolling loss" v={fmtE(sim.energy.rollingWorkJ)} />
          <Row k="Final kinetic" v={fmtE(sim.energy.finalKineticJ)} />
          <Row
            k="Audit residual"
            v={`${fmtE(sim.energy.auditErrorJ)} (${(sim.energy.auditErrorFrac * 100).toFixed(3)}%)`}
            warn={Math.abs(sim.energy.auditErrorFrac) > 0.01}
          />
        </tbody></table>
        <p className="note">
          Time step {sim.timeStepUsedS} s, {sim.steps} RK4 steps. The audit residual is the
          numerical error of the integration; it must stay below 1%.
        </p>
      </details>

      {result.warnings.length > 0 && (
        <details open>
          <summary>Dynamics warnings ({result.warnings.length})</summary>
          <ul className="dyn-warnings">
            {result.warnings.map((w, i) => (
              <li key={i} className={`sev-${w.severity}`}>
                <strong>{w.severity.toUpperCase()}:</strong> {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details>
        <summary>Assumptions ({result.assumptions.length})</summary>
        <ul className="assumptions">
          {result.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <tr className={warn ? 'row-warn' : ''}>
      <td>{k}</td>
      <td className="num">{v}</td>
    </tr>
  );
}
