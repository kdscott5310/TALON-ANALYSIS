/**
 * Brake curves & stopping simulation — Milestone 8A.
 *
 * Author or import a brake force curve, preview it, and run a reduced-order
 * 1-DOF stopping simulation (`calculations/brakeStopSim`). All engineering math
 * is in the engines (Rules 2/7); this component collects inputs and plots
 * results. Curve samples are SI (labelled); the stopping-sim inputs/outputs use
 * the active unit system. Clamp/rating warnings are surfaced (Rule 2); the panel
 * is Level 2 / reduced-order and never certified (Rule 1).
 */
import { useMemo, useState, type ChangeEvent } from 'react';
import { useAppStore } from '../state/store';
import {
  importBrakeCurveCsv,
  validateCurve,
  type BrakeCurve,
  type BrakeCurveKind,
} from '../calculations/brakeCurves';
import { simulateBrakeStop, type BrakeStopResult } from '../calculations/brakeStopSim';
import {
  formatEnergy,
  formatForce,
  formatLength,
  fromDisplayValue,
  lbToKg,
} from '../units/units';

type Row = { x: string; f: string };

const KIND_AXIS: Record<BrakeCurveKind, { label: string; unit: string }> = {
  displacementForce: { label: 'Stroke', unit: 'm' },
  velocityForce: { label: 'Speed', unit: 'm/s' },
  timeForce: { label: 'Time', unit: 's' },
  measuredCsv: { label: 'Stroke', unit: 'm' },
};

const DEFAULT_ROWS: Row[] = [
  { x: '0', f: '0' },
  { x: '0.1', f: '8000' },
  { x: '0.5', f: '20000' },
  { x: '1.0', f: '20000' },
];

export function BrakeCurvePanel() {
  const unitSystem = useAppStore((s) => s.unitSystem);
  const [kind, setKind] = useState<BrakeCurveKind>('displacementForce');
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [rawText, setRawText] = useState<string | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);

  // Sim inputs (display units).
  const [massStr, setMassStr] = useState('900');
  const [speedStr, setSpeedStr] = useState('12');
  const [strokeStr, setStrokeStr] = useState('15');
  const [ratingStr, setRatingStr] = useState('');
  const [resistStr, setResistStr] = useState('0');
  const [result, setResult] = useState<BrakeStopResult | null>(null);

  const curve: BrakeCurve = useMemo(() => {
    const parsed = rows
      .map((r) => ({ x: Number(r.x), f: Number(r.f) }))
      .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.f));
    return {
      kind,
      abscissa: parsed.map((r) => r.x),
      force: parsed.map((r) => r.f),
      interpolation: 'linear',
      source: rawText ? 'measured' : 'authored',
      rawText,
    };
  }, [rows, kind, rawText]);

  const validation = useMemo(() => validateCurve(curve), [curve]);
  const axis = KIND_AXIS[kind];

  const massKg = (v: number) => (unitSystem === 'us' ? lbToKg(v) : v);

  const onImportCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = importBrakeCurveCsv(text, kind);
    if (!parsed.ok) {
      setImportError(parsed.errors.join(' '));
      return;
    }
    setImportError(null);
    setRawText(text);
    setRows(parsed.curve.abscissa.map((x, i) => ({ x: String(x), f: String(parsed.curve.force[i]) })));
  };

  const run = () => {
    if (!validation.ok) return;
    const massDisp = Number(massStr);
    const rating = ratingStr.trim() === '' ? undefined : fromDisplayValue(Number(ratingStr), 'force', unitSystem);
    setResult(
      simulateBrakeStop({
        massKg: massKg(massDisp),
        entrySpeedMps: fromDisplayValue(Number(speedStr), 'velocity', unitSystem),
        curve,
        availableStrokeM: strokeStr.trim() === '' ? undefined : fromDisplayValue(Number(strokeStr), 'length', unitSystem),
        ratingN: rating,
        constantResistanceN: fromDisplayValue(Number(resistStr) || 0, 'force', unitSystem),
      }),
    );
  };

  return (
    <div className="single-col">
      <section className="results-panel">
        <h2>Brake curves &amp; stopping simulation <span className="badge-unverified">LEVEL 2 · NOT CERTIFIED</span></h2>
        <p className="note">
          Reduced-order 1-DOF brake stop. This does not alter the validated v1 CUFTS dynamic
          run; it is a preliminary estimate. Force is clamped at the curve endpoints — never
          extrapolated.
        </p>
      </section>

      <section className="results-panel">
        <h2>Brake force curve <span className="note">(SI samples)</span></h2>
        <div className="inspector-actions">
          <label className="inspector-field">
            Curve type
            <select value={kind} onChange={(e) => setKind(e.target.value as BrakeCurveKind)}>
              <option value="displacementForce">Force vs stroke (m)</option>
              <option value="velocityForce">Force vs speed (m/s)</option>
              <option value="timeForce">Force vs time (s)</option>
              <option value="measuredCsv">Measured CSV (stroke)</option>
            </select>
          </label>
          <label className="file-import">
            Import CSV…
            <input type="file" accept=".csv,text/csv" onChange={onImportCsv} />
          </label>
        </div>
        {importError && <p className="note" role="alert" style={{ color: 'var(--error)' }}>{importError}</p>}

        <table className="curve-table">
          <thead>
            <tr><th>{axis.label} ({axis.unit})</th><th>Force (N)</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input type="number" value={r.x} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, x: e.target.value } : x)))} /></td>
                <td><input type="number" value={r.f} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, f: e.target.value } : x)))} /></td>
                <td><button type="button" className="link-btn" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inspector-actions">
          <button type="button" onClick={() => setRows((rs) => [...rs, { x: '', f: '' }])}>Add point</button>
        </div>

        <CurvePlot curve={curve} axisLabel={`${axis.label} (${axis.unit})`} />

        {validation.errors.length > 0 && (
          <div className="warnings-panel"><ul>{validation.errors.map((e, i) => <li key={i} className="error">{e}</li>)}</ul></div>
        )}
        {validation.warnings.length > 0 && (
          <div className="warnings-panel"><ul>{validation.warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul></div>
        )}
      </section>

      <section className="results-panel">
        <h2>Stopping simulation</h2>
        <div className="inspector-actions inspector-create">
          <label className="inspector-field">Moving mass ({unitSystem === 'us' ? 'lb' : 'kg'})<input type="number" value={massStr} onChange={(e) => setMassStr(e.target.value)} /></label>
          <label className="inspector-field">Entry speed ({unitSystem === 'us' ? 'mph' : 'm/s'})<input type="number" value={speedStr} onChange={(e) => setSpeedStr(e.target.value)} /></label>
          <label className="inspector-field">Available stroke ({unitSystem === 'us' ? 'ft' : 'm'})<input type="number" value={strokeStr} onChange={(e) => setStrokeStr(e.target.value)} /></label>
          <label className="inspector-field">Brake rating ({unitSystem === 'us' ? 'lbf' : 'N'}, optional)<input type="number" value={ratingStr} onChange={(e) => setRatingStr(e.target.value)} /></label>
          <label className="inspector-field">Constant resistance ({unitSystem === 'us' ? 'lbf' : 'N'})<input type="number" value={resistStr} onChange={(e) => setResistStr(e.target.value)} /></label>
          <button type="button" disabled={!validation.ok} onClick={run}>Simulate stop</button>
        </div>

        {result && (
          <>
            <table>
              <tbody>
                <tr><td>Stopped</td><td>{result.stopped ? <span className="st-ok">yes</span> : <span className="st-failed">did not stop</span>}</td></tr>
                <tr><td>Stopping distance</td><td className="num">{formatLength(result.stoppingDistanceM, unitSystem)}{result.withinStroke === false && <span className="badge-unverified"> OVERRUN</span>}</td></tr>
                <tr><td>Stopping time</td><td className="num">{result.stoppingTimeS.toFixed(2)} s</td></tr>
                <tr><td>Peak brake force</td><td className="num">{formatForce(result.peakForceN, unitSystem)}</td></tr>
                <tr><td>Peak deceleration</td><td className="num">{(result.peakDecelerationMps2 / 9.80665).toFixed(2)} g</td></tr>
                <tr><td>Entry kinetic energy</td><td className="num">{formatEnergy(result.entryKineticEnergyJ, unitSystem)}</td></tr>
                <tr><td>Brake work</td><td className="num">{formatEnergy(result.brakeEnergyJ, unitSystem)}</td></tr>
              </tbody>
            </table>
            <p className="note">Model: {result.fidelity}.</p>
            <StopPlot result={result} />
            {result.warnings.length > 0 && (
              <div className="warnings-panel"><ul>{result.warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul></div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function CurvePlot({ curve, axisLabel }: { curve: BrakeCurve; axisLabel: string }) {
  if (curve.abscissa.length < 2) return <p className="note">Add at least two points to preview the curve.</p>;
  const xs = curve.abscissa;
  const fs = curve.force;
  const W = 100, H = 40;
  const xMin = xs[0], xMax = xs[xs.length - 1];
  const fMax = Math.max(...fs, 1);
  const sx = (x: number) => ((x - xMin) / (xMax - xMin || 1)) * W;
  const sy = (f: number) => H - (f / fMax) * H;
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${sx(x).toFixed(2)} ${sy(fs[i]).toFixed(2)}`).join(' ');
  return (
    <svg className="mini-plot" viewBox={`-6 -4 ${W + 12} ${H + 12}`} role="img" aria-label="Brake force curve">
      <line x1={0} y1={H} x2={W} y2={H} className="axis" />
      <line x1={0} y1={0} x2={0} y2={H} className="axis" />
      <path d={d} fill="none" stroke="#b45309" strokeWidth={0.8} />
      <text x={W / 2} y={H + 9} fontSize={3.5} fill="#64748b" textAnchor="middle">{axisLabel}</text>
      <text x={-4} y={2} fontSize={3.5} fill="#64748b">Force (N)</text>
    </svg>
  );
}

function StopPlot({ result }: { result: BrakeStopResult }) {
  const h = result.history;
  if (h.length < 2) return null;
  const W = 100, H = 40;
  const tMax = h[h.length - 1].t || 1;
  const vMax = Math.max(...h.map((s) => s.v), 1);
  const sx = (t: number) => (t / tMax) * W;
  const sy = (v: number) => H - (v / vMax) * H;
  const d = h.map((s, i) => `${i === 0 ? 'M' : 'L'} ${sx(s.t).toFixed(2)} ${sy(s.v).toFixed(2)}`).join(' ');
  return (
    <svg className="mini-plot" viewBox={`-6 -4 ${W + 12} ${H + 12}`} role="img" aria-label="Speed vs time">
      <line x1={0} y1={H} x2={W} y2={H} className="axis" />
      <line x1={0} y1={0} x2={0} y2={H} className="axis" />
      <path d={d} fill="none" stroke="#b91c1c" strokeWidth={0.8} />
      <text x={W / 2} y={H + 9} fontSize={3.5} fill="#64748b" textAnchor="middle">Time (s)</text>
      <text x={-4} y={2} fontSize={3.5} fill="#64748b">Speed (m/s)</text>
    </svg>
  );
}
