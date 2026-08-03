/**
 * Digital twin — measured-data correlation — Milestone 8D.
 *
 * Import measured test channels, condition them non-destructively, correlate a
 * predicted signal against the measurement (RMSE, peak/timing/integral error,
 * R², residuals), and estimate calibration parameters with identifiability
 * warnings. All math is in `calculations/testCorrelation.ts` (Rules 2/7).
 *
 * Governance shown honestly:
 *  - RAW samples are preserved and never mutated; conditioning produces a new
 *    array and the raw trace stays available for comparison (Rule 5).
 *  - A synthetic demo channel exists so the workflow can be exercised BEFORE
 *    real test data exists — it is labelled EXAMPLE ONLY throughout and a
 *    correlation against it is never validation of a design (Rule 4).
 *  - A parameter the data cannot constrain is flagged UNIDENTIFIABLE rather
 *    than reported as a confident fit.
 *  - Calibrated results are derived-from-test and remain preliminary, never
 *    certified (Rule 1).
 */
import { useMemo, useState, type ChangeEvent } from 'react';
import {
  conditionChannel,
  correlate,
  estimateParameters,
  movingAverage,
  type CorrelationMetrics,
  type EstimationResult,
  type MeasuredChannel,
  type Signal,
} from '../calculations/testCorrelation';
import {
  buildSyntheticChannel,
  importChannelCsv,
  syntheticModel,
} from '../calculations/channelCsv';

interface Source {
  channels: MeasuredChannel[];
  /** True when the data is the built-in synthetic demo, not a real measurement. */
  synthetic: boolean;
  label: string;
  rawText?: string;
}

const CSV_EXAMPLE = `time_s,cable_tension [N],payload_angle [deg]
0.00,10450,0.0
0.02,10510,0.4
0.04,10630,0.9`;

export function DigitalTwinPanel() {
  const [source, setSource] = useState<Source | null>(null);
  const [channelIndex, setChannelIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Non-destructive conditioning settings.
  const [scale, setScale] = useState('1');
  const [polarity, setPolarity] = useState<'1' | '-1'>('1');
  const [zero, setZero] = useState('0');
  const [filterWindow, setFilterWindow] = useState('1');

  // Model parameters for the correlation / estimation demo.
  const [amp, setAmp] = useState('1');
  const [decay, setDecay] = useState('0.2');
  const [freq, setFreq] = useState('0.6');
  const [estimation, setEstimation] = useState<EstimationResult | null>(null);

  const channel = source?.channels[channelIndex] ?? null;

  /** Conditioned samples — a NEW array; `channel.raw` is untouched. */
  const conditioned = useMemo(() => {
    if (!channel) return null;
    const withCal = conditionChannel({
      ...channel,
      scaleToSI: Number(scale) || 1,
      polarity: polarity === '-1' ? -1 : 1,
      zeroOffset: Number(zero) || 0,
    });
    const w = Math.max(1, Math.round(Number(filterWindow) || 1));
    const odd = w % 2 === 0 ? w + 1 : w;
    return odd > 1 ? movingAverage(withCal, odd) : withCal;
  }, [channel, scale, polarity, zero, filterWindow]);

  const measuredSignal: Signal | null = useMemo(
    () => (channel && conditioned ? { timeS: channel.timeS, values: conditioned } : null),
    [channel, conditioned],
  );

  const predicted: Signal | null = useMemo(() => {
    if (!channel) return null;
    return syntheticModel(
      { amplitude: Number(amp) || 0, decayRate: Number(decay) || 0, frequencyHz: Number(freq) || 0 },
      channel.timeS,
    );
  }, [channel, amp, decay, freq]);

  const correlation = useMemo(() => {
    if (!predicted || !measuredSignal) return null;
    try {
      return correlate(predicted, measuredSignal, 0.5, 0.01);
    } catch {
      return null;
    }
  }, [predicted, measuredSignal]);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const result = importChannelCsv(text);
    if (!result.ok) {
      setError(`Could not import "${file.name}": ${result.errors.slice(0, 3).join(' ')}`);
      setWarnings([]);
      return;
    }
    setSource({ channels: result.channels, synthetic: false, label: file.name, rawText: result.rawText });
    setChannelIndex(0);
    setEstimation(null);
    setError(null);
    setWarnings(result.warnings);
  };

  const loadSynthetic = () => {
    const ch = buildSyntheticChannel({ name: 'Synthetic transient (EXAMPLE ONLY)', unit: '—' });
    setSource({ channels: [ch], synthetic: true, label: 'Built-in synthetic demo' });
    setChannelIndex(0);
    setEstimation(null);
    setError(null);
    setWarnings([]);
  };

  const runEstimation = () => {
    if (!measuredSignal || !channel) return;
    setEstimation(
      estimateParameters(
        [
          { key: 'amplitude', label: 'Amplitude', min: 0.1, max: 3, initial: Number(amp) || 1 },
          { key: 'decayRate', label: 'Decay rate', min: 0.01, max: 2, initial: Number(decay) || 0.2 },
          { key: 'frequencyHz', label: 'Frequency', min: 0.1, max: 2, initial: Number(freq) || 0.6 },
        ],
        (p) => syntheticModel(
          { amplitude: p.amplitude, decayRate: p.decayRate, frequencyHz: p.frequencyHz },
          channel.timeS,
        ),
        measuredSignal,
      ),
    );
  };

  const applyEstimated = () => {
    if (!estimation) return;
    setAmp(String(Number(estimation.bestParams.amplitude.toPrecision(6))));
    setDecay(String(Number(estimation.bestParams.decayRate.toPrecision(6))));
    setFreq(String(Number(estimation.bestParams.frequencyHz.toPrecision(6))));
  };

  return (
    <div className="single-col">
      <section className="results-panel">
        <h2>
          Digital twin — measured-data correlation{' '}
          <span className="badge-unverified">PRELIMINARY · NOT CERTIFIED</span>
        </h2>
        <p className="note">
          Correlate a predicted signal against measured test data, and calibrate model
          parameters against it. Raw imported samples are never modified — conditioning and
          filtering always produce a separate working copy. A calibrated model is
          derived-from-test and remains preliminary; it is never certified.
        </p>
      </section>

      <section className="results-panel">
        <h2>Measured data</h2>
        <div className="inspector-actions">
          <label className="file-import">
            Import channel CSV…
            <input type="file" accept=".csv,text/csv" onChange={onImport} />
          </label>
          <button type="button" onClick={loadSynthetic}>Load synthetic demo</button>
        </div>

        {!source && (
          <>
            <p className="note">
              No measured data loaded. Bring a CSV with a header row, time in seconds in the
              first column, and one column per channel — a unit in brackets is picked up
              automatically:
            </p>
            <pre className="run-header">{CSV_EXAMPLE}</pre>
            <p className="note">
              No test data yet? <strong>Load synthetic demo</strong> exercises the whole workflow
              with a generated transient. It is <strong>example-only</strong> — correlating against
              it demonstrates the tooling and validates nothing about a real design.
            </p>
          </>
        )}

        {error && <p className="note" role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        {warnings.length > 0 && (
          <div className="warnings-panel"><ul>{warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul></div>
        )}

        {source && channel && (
          <>
            <p className="note">
              {source.label} · {source.channels.length} channel(s) · {channel.timeS.length} samples ·{' '}
              {channel.sampleRateHz ? `${channel.sampleRateHz.toFixed(1)} Hz` : 'rate unknown'}
              {source.synthetic && <span className="badge-unverified"> SYNTHETIC — EXAMPLE ONLY, NOT MEASURED DATA</span>}
            </p>
            {source.channels.length > 1 && (
              <label className="inspector-field">
                Channel
                <select value={channelIndex} onChange={(e) => { setChannelIndex(Number(e.target.value)); setEstimation(null); }}>
                  {source.channels.map((c, i) => (
                    <option key={c.name} value={i}>{c.name}{c.unit ? ` [${c.unit}]` : ''}</option>
                  ))}
                </select>
              </label>
            )}

            <p className="solver-warn-heading">Conditioning (non-destructive)</p>
            <div className="inspector-actions inspector-create">
              <label className="inspector-field">Scale to SI<input type="number" value={scale} onChange={(e) => setScale(e.target.value)} /></label>
              <label className="inspector-field">
                Polarity
                <select value={polarity} onChange={(e) => setPolarity(e.target.value as '1' | '-1')}>
                  <option value="1">+1</option>
                  <option value="-1">−1 (invert)</option>
                </select>
              </label>
              <label className="inspector-field">Zero offset<input type="number" value={zero} onChange={(e) => setZero(e.target.value)} /></label>
              <label className="inspector-field">Filter window (samples)<input type="number" value={filterWindow} onChange={(e) => setFilterWindow(e.target.value)} /></label>
            </div>
            <p className="note">
              Raw first sample: <strong>{fmt(channel.raw[0])}</strong> · conditioned first sample:{' '}
              <strong>{fmt(conditioned?.[0])}</strong> — the raw array is preserved unchanged.
            </p>
          </>
        )}
      </section>

      {source && channel && predicted && (
        <section className="results-panel">
          <h2>Predicted model &amp; correlation</h2>
          <div className="inspector-actions inspector-create">
            <label className="inspector-field">Amplitude<input type="number" value={amp} onChange={(e) => setAmp(e.target.value)} /></label>
            <label className="inspector-field">Decay rate (1/s)<input type="number" value={decay} onChange={(e) => setDecay(e.target.value)} /></label>
            <label className="inspector-field">Frequency (Hz)<input type="number" value={freq} onChange={(e) => setFreq(e.target.value)} /></label>
            <button type="button" onClick={runEstimation}>Estimate parameters from data</button>
          </div>

          <OverlayPlot measured={{ timeS: channel.timeS, values: conditioned ?? [] }} predicted={predicted} />

          {correlation && <MetricsTable metrics={correlation.metrics} shiftS={correlation.bestShiftS} unit={channel.unit} />}
          {correlation && <ResidualPlot residual={correlation.residual} />}
        </section>
      )}

      {estimation && (
        <section className="results-panel">
          <h2>Parameter estimation</h2>
          <table className="compare-table">
            <thead><tr><th>Parameter</th><th>Estimated</th><th>Identifiability</th></tr></thead>
            <tbody>
              {estimation.identifiability.map((p) => (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  <td className="num">{fmt(estimation.bestParams[p.key])}</td>
                  <td>
                    {p.identifiable
                      ? <span className="st-ok">identifiable (RMSE sensitivity {fmt(p.rmseSensitivity)})</span>
                      : <span className="st-failed">UNIDENTIFIABLE — the data cannot constrain this parameter</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <tbody>
              <tr><td>RMSE before</td><td className="num">{fmt(estimation.initialRmse)}</td></tr>
              <tr><td>RMSE after</td><td className="num">{fmt(estimation.bestRmse)}</td></tr>
              <tr><td>Iterations</td><td className="num">{estimation.iterations}</td></tr>
            </tbody>
          </table>
          <div className="inspector-actions">
            <button type="button" onClick={applyEstimated}>Apply estimated parameters to the model</button>
          </div>
          <p className="note">
            A calibrated model is <strong>derived from this specific test</strong> and remains
            preliminary — fitting data does not validate the model outside the conditions it was
            measured under, and it is never certified.
            {source?.synthetic && ' These parameters were fitted to SYNTHETIC example data and mean nothing physically.'}
          </p>
          {estimation.warnings.length > 0 && (
            <div className="warnings-panel"><ul>{estimation.warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul></div>
          )}
        </section>
      )}
    </div>
  );
}

function MetricsTable({ metrics, shiftS, unit }: { metrics: CorrelationMetrics; shiftS: number; unit?: string }) {
  const u = unit && unit !== '—' ? ` ${unit}` : '';
  return (
    <table>
      <tbody>
        <tr><td>RMSE</td><td className="num">{fmt(metrics.rmse)}{u}</td></tr>
        <tr><td>Peak absolute residual</td><td className="num">{fmt(metrics.peakError)}{u}</td></tr>
        <tr><td>Peak-value error (pred − meas)</td><td className="num">{fmt(metrics.peakValueError)}{u}</td></tr>
        <tr><td>Timing error (best shift)</td><td className="num">{fmt(metrics.timingErrorS)} s</td></tr>
        <tr><td>Integral (energy-like) error</td><td className="num">{fmt(metrics.integralError)}</td></tr>
        <tr><td>R²</td><td className="num">{fmt(metrics.r2)}</td></tr>
        <tr><td>Comparison points</td><td className="num">{metrics.points}</td></tr>
        <tr><td>Applied time shift</td><td className="num">{fmt(shiftS)} s</td></tr>
      </tbody>
    </table>
  );
}

function OverlayPlot({ measured, predicted }: { measured: Signal; predicted: Signal }) {
  if (measured.values.length < 2) return null;
  const W = 100, H = 40;
  const tMax = Math.max(measured.timeS[measured.timeS.length - 1], 1e-9);
  const all = [...measured.values, ...predicted.values];
  const vMax = Math.max(...all.map(Math.abs), 1e-9);
  const sx = (t: number) => (t / tMax) * W;
  const sy = (v: number) => H / 2 - (v / vMax) * (H / 2);
  const path = (s: Signal) =>
    s.timeS.map((t, i) => `${i === 0 ? 'M' : 'L'} ${sx(t).toFixed(2)} ${sy(s.values[i]).toFixed(2)}`).join(' ');
  return (
    <svg className="mini-plot" viewBox={`-6 -4 ${W + 12} ${H + 12}`} role="img" aria-label="Measured vs predicted overlay">
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="axis" />
      <line x1={0} y1={0} x2={0} y2={H} className="axis" />
      <path d={path(measured)} fill="none" stroke="#145a8a" strokeWidth={0.7} />
      <path d={path(predicted)} fill="none" stroke="#b91c1c" strokeWidth={0.7} strokeDasharray="2 1.5" />
      <text x={W / 2} y={H + 9} fontSize={3.5} fill="#64748b" textAnchor="middle">Time (s)</text>
      <text x={2} y={-1} fontSize={3.2} fill="#145a8a">— measured</text>
      <text x={26} y={-1} fontSize={3.2} fill="#b91c1c">-- predicted</text>
    </svg>
  );
}

function ResidualPlot({ residual }: { residual: Signal }) {
  if (residual.values.length < 2) return null;
  const W = 100, H = 26;
  const tMax = Math.max(residual.timeS[residual.timeS.length - 1], 1e-9);
  const vMax = Math.max(...residual.values.map(Math.abs), 1e-9);
  const sx = (t: number) => (t / tMax) * W;
  const sy = (v: number) => H / 2 - (v / vMax) * (H / 2);
  const d = residual.timeS.map((t, i) => `${i === 0 ? 'M' : 'L'} ${sx(t).toFixed(2)} ${sy(residual.values[i]).toFixed(2)}`).join(' ');
  return (
    <svg className="mini-plot" viewBox={`-6 -4 ${W + 12} ${H + 12}`} role="img" aria-label="Residual">
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="axis" />
      <path d={d} fill="none" stroke="#7c3aed" strokeWidth={0.6} />
      <text x={W / 2} y={H + 9} fontSize={3.5} fill="#64748b" textAnchor="middle">Residual (predicted − measured)</text>
    </svg>
  );
}

function fmt(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  return Number(v.toPrecision(5)).toString();
}
