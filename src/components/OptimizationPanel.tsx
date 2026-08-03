/**
 * Design optimization — Milestone 8C.
 *
 * Searches CUFTS design parameters for a better design using the tested
 * bounded/constrained optimizer (`calculations/optimization.ts`) driven by the
 * objective adapter (`calculations/cuftsObjective.ts`), which runs the VALIDATED
 * v1 solvers unchanged. All math is in the engines (Rules 2/7).
 *
 * Governance shown honestly: an infeasible problem is reported as such with its
 * controlling constraints — never dressed up as a valid design (R-6); a failed
 * or non-finite evaluation is rejected, not scored; the full search history and
 * local sensitivity are shown; results are preliminary and never certified.
 */
import { useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import { optimize, type OptimizationResult } from '../calculations/optimization';
import {
  CUFTS_CONSTRAINTS,
  CUFTS_OBJECTIVES,
  CUFTS_VARIABLES,
  evaluateVariables,
  type CuftsLimits,
  type CuftsMetrics,
  type CuftsObjectiveKey,
  type CuftsVariableKey,
} from '../calculations/cuftsObjective';
import { formatForce, formatLength, formatMass, formatSpeed } from '../units/units';

type VarState = { enabled: boolean; min: string; max: string };

/**
 * Constraint-satisfaction tolerance, in constraint units.
 *
 * A penalty method converges onto an ACTIVE constraint from the infeasible side
 * by a vanishing amount, so an exactly-at-the-limit design lands a hair over
 * (e.g. 3e-6 m/s on a 20 m/s speed limit). Flagging that as "not a valid design"
 * would cry wolf and train engineers to ignore the flag — itself a safety
 * problem. This tolerance is deliberately small, is DISCLOSED in the UI, and a
 * constraint satisfied only within it is labelled "at limit", never "clear".
 */
const FEASIBILITY_TOLERANCE = 1e-4;

export function OptimizationPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);

  const baseline = useMemo(
    () => ({
      pretensionN: scenario.cable.pretensionN,
      brakeForceN: scenario.brake.brakeForceN,
      brakeZoneLengthM: scenario.site.brakeZoneLengthM,
      blocksPerAnchor: scenario.anchors.blocksPerAnchor,
      designFactor: scenario.cable.designFactor,
    }),
    [scenario],
  );

  const [objectiveKey, setObjectiveKey] = useState<CuftsObjectiveKey>('peakTension');
  const [vars, setVars] = useState<Record<string, VarState>>(() => {
    const init: Record<string, VarState> = {};
    for (const v of CUFTS_VARIABLES) {
      init[v.key] = {
        enabled: v.key === 'pretensionN',
        min: String(v.defaultMin),
        max: String(v.defaultMax),
      };
    }
    return init;
  });
  const [enabledConstraints, setEnabledConstraints] = useState<Record<string, boolean>>(
    () => Object.fromEntries(CUFTS_CONSTRAINTS.map((c) => [c.key, true])),
  );
  const [maxDecelG, setMaxDecelG] = useState('5');
  const [maxUtil, setMaxUtil] = useState('1');
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [running, setRunning] = useState(false);

  const baselineMetrics = useMemo(() => evaluateVariables(scenario, baseline), [scenario, baseline]);

  const limits: CuftsLimits = {
    maxCableUtilization: Number(maxUtil) || 1,
    maxDecelG: Number(maxDecelG) || 5,
    maxSpeedMps: scenario.trolley.maxAllowableSpeedMps,
    availableStrokeM: scenario.brake.availableStrokeM,
  };

  const selectedVars = CUFTS_VARIABLES.filter((v) => vars[v.key]?.enabled);

  const run = () => {
    if (selectedVars.length === 0) return;
    setRunning(true);
    const objective = CUFTS_OBJECTIVES.find((o) => o.key === objectiveKey)!;
    const evalAt = (x: Record<string, number>) => evaluateVariables(scenario, { ...baseline, ...x });
    try {
      setResult(
        optimize({
          variables: selectedVars.map((v) => ({
            key: v.key,
            label: v.label,
            min: Number(vars[v.key].min),
            max: Number(vars[v.key].max),
            start: baseline[v.key as CuftsVariableKey],
          })),
          objective: (x) => objective.read(evalAt(x)),
          constraints: CUFTS_CONSTRAINTS.filter((c) => enabledConstraints[c.key]).map((c) => ({
            key: c.key,
            label: c.label,
            evaluate: (x: Record<string, number>) => c.read(evalAt(x), limits),
          })),
          maxIterations: 8,
          feasibilityTolerance: FEASIBILITY_TOLERANCE,
        }),
      );
    } finally {
      setRunning(false);
    }
  };

  const bestMetrics = result?.success
    ? evaluateVariables(scenario, { ...baseline, ...result.bestVariables })
    : null;

  return (
    <div className="single-col">
      <section className="results-panel">
        <h2>
          Design optimization <span className="badge-unverified">PRELIMINARY · NOT CERTIFIED</span>
        </h2>
        <p className="note">
          Searches the parameters you enable, re-running the validated v1 solvers at every
          candidate. An infeasible problem is reported as infeasible — never as a design.
          Results are a starting point for engineering judgement, not an approved design.
        </p>
      </section>

      <section className="results-panel">
        <h2>Objective &amp; variables</h2>
        <div className="inspector-actions inspector-create">
          <label className="inspector-field">
            Objective
            <select value={objectiveKey} onChange={(e) => setObjectiveKey(e.target.value as CuftsObjectiveKey)}>
              {CUFTS_OBJECTIVES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <label className="inspector-field">Max cable utilization<input type="number" value={maxUtil} onChange={(e) => setMaxUtil(e.target.value)} /></label>
          <label className="inspector-field">Max deceleration (g)<input type="number" value={maxDecelG} onChange={(e) => setMaxDecelG(e.target.value)} /></label>
        </div>

        <table className="compare-table">
          <thead>
            <tr><th>Vary</th><th>Parameter</th><th>Baseline</th><th>Min</th><th>Max</th></tr>
          </thead>
          <tbody>
            {CUFTS_VARIABLES.map((v) => (
              <tr key={v.key}>
                <td>
                  <input
                    type="checkbox"
                    checked={vars[v.key].enabled}
                    onChange={(e) => setVars((s) => ({ ...s, [v.key]: { ...s[v.key], enabled: e.target.checked } }))}
                  />
                </td>
                <td>{v.label} <span className="note">({v.unit})</span></td>
                <td className="num">{trim(baseline[v.key])}</td>
                <td><input type="number" value={vars[v.key].min} onChange={(e) => setVars((s) => ({ ...s, [v.key]: { ...s[v.key], min: e.target.value } }))} style={{ width: 90 }} /></td>
                <td><input type="number" value={vars[v.key].max} onChange={(e) => setVars((s) => ({ ...s, [v.key]: { ...s[v.key], max: e.target.value } }))} style={{ width: 90 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="solver-warn-heading">Constraints</p>
        <div className="inspector-checks">
          {CUFTS_CONSTRAINTS.map((c) => (
            <label key={c.key}>
              <input
                type="checkbox"
                checked={enabledConstraints[c.key]}
                onChange={(e) => setEnabledConstraints((s) => ({ ...s, [c.key]: e.target.checked }))}
              />
              {c.label}
            </label>
          ))}
        </div>

        <div className="inspector-actions">
          <button type="button" disabled={selectedVars.length === 0 || running} onClick={run}>
            {running ? 'Searching…' : 'Run optimization'}
          </button>
          {selectedVars.length === 0 && <span className="note">Enable at least one parameter to vary.</span>}
        </div>
      </section>

      {result && (
        <section className="results-panel">
          <h2>
            Result{' '}
            {result.feasible
              ? <span className="st-ok">FEASIBLE</span>
              : <span className="st-failed">INFEASIBLE — not a valid design</span>}
          </h2>

          {result.failureReason && (
            <div className="warnings-panel"><ul><li className="error">{result.failureReason}</li></ul></div>
          )}

          {!result.feasible && result.controllingConstraints.length > 0 && (
            <>
              <p className="solver-warn-heading">Controlling (violated) constraints</p>
              <div className="warnings-panel">
                <ul>
                  {result.controllingConstraints.map((c) => (
                    <li key={c.key} className="error">{c.label} — violated by {trim(c.value)}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <table className="compare-table">
            <thead><tr><th>Parameter</th><th>Baseline</th><th>Optimized</th><th>Change</th></tr></thead>
            <tbody>
              {selectedVars.map((v) => {
                const before = baseline[v.key];
                const after = result.bestVariables[v.key];
                return (
                  <tr key={v.key}>
                    <td>{v.label} <span className="note">({v.unit})</span></td>
                    <td className="num">{trim(before)}</td>
                    <td className="num">{after === undefined ? '—' : trim(after)}</td>
                    <td className="num">{after === undefined || before === 0 ? '—' : `${(((after - before) / before) * 100).toFixed(1)} %`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {bestMetrics && (
            <>
              <p className="solver-warn-heading">Predicted performance (baseline → optimized)</p>
              <MetricsTable baseline={baselineMetrics} best={bestMetrics} unitSystem={unitSystem} />
            </>
          )}

          <details>
            <summary>Constraint values at the chosen point</summary>
            <table>
              <tbody>
                {result.constraints.map((c) => (
                  <tr key={c.key}>
                    <td>{c.label}</td>
                    <td className="num">{trim(c.value)}</td>
                    <td>
                      {!c.satisfied ? (
                        <span className="st-failed">violated</span>
                      ) : c.value > -FEASIBILITY_TOLERANCE ? (
                        <span className="st-caution">at limit (active)</span>
                      ) : (
                        <span className="st-ok">satisfied</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              Constraints are written as g ≤ 0 and treated as satisfied within a tolerance of{' '}
              {FEASIBILITY_TOLERANCE} in constraint units, because the search converges onto an
              active constraint from the infeasible side by a vanishing amount. A constraint
              satisfied only within that tolerance is shown as <strong>at limit</strong> — it is
              sitting exactly on its limit with no margin, and needs engineering judgement.
            </p>
          </details>

          <details>
            <summary>Local sensitivity (objective change per unit)</summary>
            <table>
              <tbody>
                {result.sensitivity.map((s) => (
                  <tr key={s.key}>
                    <td>{s.label}</td>
                    <td className="num">{Number.isFinite(s.gradient) ? trim(s.gradient) : <span className="badge-locked">not evaluable</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <details>
            <summary>Search history ({result.history.length} accepted steps, {result.iterations} iterations)</summary>
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr><th>#</th>{selectedVars.map((v) => <th key={v.key}>{v.label}</th>)}<th>Objective</th></tr>
                </thead>
                <tbody>
                  {result.history.map((h, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      {selectedVars.map((v) => <td key={v.key} className="num">{trim(h.variables[v.key])}</td>)}
                      <td className="num">{Number.isFinite(h.objective) ? trim(h.objective) : <span className="badge-locked">rejected</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {result.warnings.length > 0 && (
            <div className="warnings-panel">
              <ul>{result.warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MetricsTable({
  baseline,
  best,
  unitSystem,
}: {
  baseline: CuftsMetrics;
  best: CuftsMetrics;
  unitSystem: 'us' | 'si';
}) {
  const rows: { label: string; fmt: (m: CuftsMetrics) => string }[] = [
    { label: 'Peak cable tension', fmt: (m) => formatForce(m.peakTensionN, unitSystem) },
    { label: 'Cable utilization', fmt: (m) => `${(m.cableUtilization * 100).toFixed(1)} %` },
    { label: 'Ground clearance margin', fmt: (m) => formatLength(m.groundClearanceMarginM, unitSystem) },
    { label: 'Peak speed', fmt: (m) => formatSpeed(m.peakSpeedMps, unitSystem) },
    { label: 'Peak deceleration', fmt: (m) => `${m.peakDecelG.toFixed(2)} g` },
    { label: 'Brake stroke used', fmt: (m) => (Number.isFinite(m.strokeUsedM) ? formatLength(m.strokeUsedM, unitSystem) : 'did not stop') },
    { label: 'Ballast mass (both anchors)', fmt: (m) => formatMass(m.ballastMassKg, unitSystem) },
  ];
  return (
    <table className="compare-table">
      <thead><tr><th>Metric</th><th>Baseline</th><th>Optimized</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td className="num">{r.fmt(baseline)}</td>
            <td className="num">{r.fmt(best)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function trim(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  return Number(v.toPrecision(6)).toString();
}
