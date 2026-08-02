/**
 * Coupled dynamics — Milestone 8B. **Level 2 (reduced-order).**
 *
 * Surfaces two tested engines:
 *  - wheel rotational inertia (`calculations/wheelDynamics.ts`) — effective mass
 *    m_eff = m + I/r², rotational energy, wheel speed. Zero inertia reduces
 *    EXACTLY to the point-mass result.
 *  - damped payload pendulum (`calculations/payloadPendulum.ts`) — longitudinal
 *    pitch and lateral sway, peak angles, envelope, attachment reaction,
 *    natural period, settling time, ground clearance.
 *
 * All engineering math lives in the engines (Rules 2/7); this panel collects
 * inputs in the active unit system and renders results. Inputs the migrated
 * CUFTS project marks *missing* must be entered here — nothing is defaulted to
 * zero silently (Rules 3/4), and results are never certified (Rule 1).
 */
import { useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import {
  computeWheelInertia,
  effectiveMass,
  wheelAngularSpeed,
  wheelRotationalEnergy,
  type WheelInertiaInput,
} from '../calculations/wheelDynamics';
import {
  solvePayloadPendulum,
  type PayloadPendulumResult,
} from '../calculations/payloadPendulum';
import {
  formatEnergy,
  formatForce,
  formatLength,
  formatMass,
  fromDisplayValue,
  lbToKg,
} from '../units/units';

const DEG = 180 / Math.PI;

/** A number field that stays EMPTY until entered — missing is never 0. */
function num(s: string): number | null {
  if (s.trim() === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function CoupledDynamicsPanel() {
  const unitSystem = useAppStore((s) => s.unitSystem);
  const massUnit = unitSystem === 'us' ? 'lb' : 'kg';
  const lenUnit = unitSystem === 'us' ? 'ft' : 'm';
  const toKg = (v: number) => (unitSystem === 'us' ? lbToKg(v) : v);
  const toM = (v: number) => fromDisplayValue(v, 'length', unitSystem);
  const toMps = (v: number) => fromDisplayValue(v, 'velocity', unitSystem);

  return (
    <div className="single-col">
      <section className="results-panel">
        <h2>
          Coupled dynamics <span className="badge-unverified">LEVEL 2 · REDUCED-ORDER · NOT CERTIFIED</span>
        </h2>
        <p className="note">
          Wheel rotational inertia and the damped payload pendulum. These are preliminary
          reduced-order models — not a multibody or finite-element simulation, and they do
          not alter the validated v1 dynamic run. Values the project does not carry must be
          entered below; a blank input is treated as <em>not entered</em>, never as zero.
        </p>
      </section>

      <WheelInertiaSection unitSystem={unitSystem} massUnit={massUnit} lenUnit={lenUnit} toKg={toKg} toM={toM} toMps={toMps} />
      <PendulumSection unitSystem={unitSystem} massUnit={massUnit} lenUnit={lenUnit} toKg={toKg} toM={toM} toMps={toMps} />
    </div>
  );
}

interface SectionProps {
  unitSystem: 'us' | 'si';
  massUnit: string;
  lenUnit: string;
  toKg: (v: number) => number;
  toM: (v: number) => number;
  toMps: (v: number) => number;
}

function WheelInertiaSection({ unitSystem, massUnit, lenUnit, toKg, toM, toMps }: SectionProps) {
  const [method, setMethod] = useState<'geometry' | 'direct'>('geometry');
  const [movingMass, setMovingMass] = useState('900');
  const [speed, setSpeed] = useState('12');
  const [radius, setRadius] = useState('');
  const [wheelCount, setWheelCount] = useState('4');
  const [wheelMass, setWheelMass] = useState('');
  const [coeff, setCoeff] = useState('0.5');
  const [inertia, setInertia] = useState('');

  const missing: string[] = [];
  const mMoving = num(movingMass);
  const vTravel = num(speed);
  const r = num(radius);
  if (mMoving === null) missing.push('moving mass');
  if (vTravel === null) missing.push('travel speed');
  if (r === null) missing.push('rolling radius');
  if (method === 'geometry') {
    if (num(wheelMass) === null) missing.push('wheel mass');
    if (num(wheelCount) === null) missing.push('wheel count');
    if (num(coeff) === null) missing.push('inertia coefficient');
  } else if (num(inertia) === null) {
    missing.push('total rotary inertia');
  }

  const result = useMemo(() => {
    if (missing.length > 0 || mMoving === null || vTravel === null || r === null) return null;
    const input: WheelInertiaInput =
      method === 'geometry'
        ? {
            kind: 'geometry',
            wheelCount: Math.round(num(wheelCount)!),
            wheelMassKg: toKg(num(wheelMass)!),
            rollingRadiusM: toM(r),
            inertiaCoefficient: num(coeff)!,
          }
        : {
            kind: 'direct',
            // Rotary inertia is entered in SI (kg·m²) — no US customary analogue offered.
            totalRotaryInertiaKgM2: num(inertia)!,
            rollingRadiusM: toM(r),
          };
    const wheels = computeWheelInertia(input);
    if (wheels.failureReason) return { wheels, effective: null, energy: 0, omega: 0, pointMass: 0 };
    const mKg = toKg(mMoving);
    return {
      wheels,
      effective: effectiveMass(mKg, wheels),
      energy: wheelRotationalEnergy(wheels, toMps(vTravel)),
      omega: wheelAngularSpeed(wheels, toMps(vTravel)),
      pointMass: mKg,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, movingMass, speed, radius, wheelCount, wheelMass, coeff, inertia, unitSystem]);

  return (
    <section className="results-panel">
      <h2>Wheel rotational inertia</h2>
      <div className="inspector-actions inspector-create">
        <label className="inspector-field">
          Method
          <select value={method} onChange={(e) => setMethod(e.target.value as 'geometry' | 'direct')}>
            <option value="geometry">Estimate from geometry (I = k·m·r²)</option>
            <option value="direct">Enter total rotary inertia</option>
          </select>
        </label>
        <label className="inspector-field">Moving mass ({massUnit})<input type="number" value={movingMass} onChange={(e) => setMovingMass(e.target.value)} /></label>
        <label className="inspector-field">Travel speed ({unitSystem === 'us' ? 'mph' : 'm/s'})<input type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} /></label>
        <label className="inspector-field">Rolling radius ({lenUnit})<input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="not entered" /></label>
        {method === 'geometry' ? (
          <>
            <label className="inspector-field">Wheel count<input type="number" value={wheelCount} onChange={(e) => setWheelCount(e.target.value)} /></label>
            <label className="inspector-field">Wheel mass each ({massUnit})<input type="number" value={wheelMass} onChange={(e) => setWheelMass(e.target.value)} placeholder="not entered" /></label>
            <label className="inspector-field">Inertia coeff. k<input type="number" value={coeff} onChange={(e) => setCoeff(e.target.value)} /></label>
          </>
        ) : (
          <label className="inspector-field">Total rotary inertia (kg·m²)<input type="number" value={inertia} onChange={(e) => setInertia(e.target.value)} placeholder="not entered" /></label>
        )}
      </div>

      {missing.length > 0 ? (
        <p className="note"><span className="badge-locked">insufficient information</span> — enter: {missing.join(', ')}.</p>
      ) : result?.wheels.failureReason ? (
        <div className="warnings-panel"><ul><li className="error">{result.wheels.failureReason}</li></ul></div>
      ) : result && result.effective !== null ? (
        <>
          <table>
            <tbody>
              <tr><td>Total wheel rotary inertia</td><td className="num">{result.wheels.totalRotaryInertiaKgM2.toFixed(3)} kg·m²</td></tr>
              <tr><td>Rotational mass-equivalent (I/r²)</td><td className="num">{formatMass(result.wheels.equivalentRotationalMassKg, unitSystem)}</td></tr>
              <tr><td>Point mass (translation only)</td><td className="num">{formatMass(result.pointMass, unitSystem)}</td></tr>
              <tr><td><strong>Effective mass (m + I/r²)</strong></td><td className="num"><strong>{formatMass(result.effective, unitSystem)}</strong></td></tr>
              <tr><td>Increase over point mass</td><td className="num">{(((result.effective - result.pointMass) / result.pointMass) * 100).toFixed(1)} %</td></tr>
              <tr><td>Wheel rotational energy at speed</td><td className="num">{formatEnergy(result.energy, unitSystem)}</td></tr>
              <tr><td>Wheel angular speed</td><td className="num">{result.omega.toFixed(1)} rad/s</td></tr>
            </tbody>
          </table>
          <p className="note">
            A force produces a = F / m_eff, so wheel inertia makes the trolley harder to
            accelerate and to stop. With zero wheel inertia this reduces exactly to the
            point-mass result. Method: {result.wheels.method}
            {result.wheels.inertiaCoefficient !== undefined && ` (k = ${result.wheels.inertiaCoefficient})`}.
          </p>
          {result.wheels.warnings.length > 0 && (
            <div className="warnings-panel"><ul>{result.wheels.warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul></div>
          )}
          <ul className="assumptions">{result.wheels.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </>
      ) : null}
    </section>
  );
}

function PendulumSection({ unitSystem, massUnit, lenUnit, toKg, toM, toMps }: SectionProps) {
  const [payloadMass, setPayloadMass] = useState('180');
  const [suspension, setSuspension] = useState('');
  const [damping, setDamping] = useState('');
  const [brakeDecel, setBrakeDecel] = useState('4');
  const [brakeDuration, setBrakeDuration] = useState('2');
  const [crosswind, setCrosswind] = useState('0');
  const [gust, setGust] = useState('0');
  const [dragArea, setDragArea] = useState('0.5');
  const [clearance, setClearance] = useState('');
  const [result, setResult] = useState<PayloadPendulumResult | null>(null);

  const missing: string[] = [];
  if (num(payloadMass) === null) missing.push('payload mass');
  if (num(suspension) === null) missing.push('suspension length');
  if (num(damping) === null) missing.push('damping ratio');

  const run = () => {
    const m = num(payloadMass);
    const L = num(suspension);
    const z = num(damping);
    if (m === null || L === null || z === null) return;
    const decel = num(brakeDecel) ?? 0;
    const dur = num(brakeDuration) ?? 0;
    // A braking pulse: constant deceleration for `dur` seconds, then coast.
    const history = [
      { tS: 0, aAlongTrackMps2: -Math.abs(decel) },
      { tS: Math.max(dur, 0.01), aAlongTrackMps2: -Math.abs(decel) },
      { tS: Math.max(dur, 0.01) + 0.001, aAlongTrackMps2: 0 },
      { tS: Math.max(dur, 0.01) + 20, aAlongTrackMps2: 0 },
    ];
    setResult(
      solvePayloadPendulum({
        suspensionLengthM: toM(L),
        payloadMassKg: toKg(m),
        dampingRatio: z,
        crosswindMps: toMps(num(crosswind) ?? 0),
        gustMps: toMps(num(gust) ?? 0),
        payloadDragAreaM2: num(dragArea) ?? undefined,
        accelerationHistory: history,
        restGroundClearanceM: num(clearance) === null ? undefined : toM(num(clearance)!),
      }),
    );
  };

  return (
    <section className="results-panel">
      <h2>Damped payload pendulum</h2>
      <div className="inspector-actions inspector-create">
        <label className="inspector-field">Payload mass ({massUnit})<input type="number" value={payloadMass} onChange={(e) => setPayloadMass(e.target.value)} /></label>
        <label className="inspector-field">Suspension length ({lenUnit})<input type="number" value={suspension} onChange={(e) => setSuspension(e.target.value)} placeholder="not entered" /></label>
        <label className="inspector-field">Damping ratio ζ<input type="number" value={damping} onChange={(e) => setDamping(e.target.value)} placeholder="not entered" /></label>
        <label className="inspector-field">Brake deceleration (m/s²)<input type="number" value={brakeDecel} onChange={(e) => setBrakeDecel(e.target.value)} /></label>
        <label className="inspector-field">Braking duration (s)<input type="number" value={brakeDuration} onChange={(e) => setBrakeDuration(e.target.value)} /></label>
        <label className="inspector-field">Crosswind ({unitSystem === 'us' ? 'mph' : 'm/s'})<input type="number" value={crosswind} onChange={(e) => setCrosswind(e.target.value)} /></label>
        <label className="inspector-field">Gust ({unitSystem === 'us' ? 'mph' : 'm/s'})<input type="number" value={gust} onChange={(e) => setGust(e.target.value)} /></label>
        <label className="inspector-field">Payload drag area Cd·A (m²)<input type="number" value={dragArea} onChange={(e) => setDragArea(e.target.value)} /></label>
        <label className="inspector-field">Rest ground clearance ({lenUnit})<input type="number" value={clearance} onChange={(e) => setClearance(e.target.value)} placeholder="optional" /></label>
        <button type="button" disabled={missing.length > 0} onClick={run}>Solve pendulum</button>
      </div>

      {missing.length > 0 && (
        <p className="note"><span className="badge-locked">insufficient information</span> — enter: {missing.join(', ')}.</p>
      )}

      {result && (result.failureReason ? (
        <div className="warnings-panel"><ul><li className="error">{result.failureReason}</li></ul></div>
      ) : (
        <>
          <table>
            <tbody>
              <tr><td>Natural period</td><td className="num">{result.naturalPeriodS.toFixed(2)} s</td></tr>
              <tr><td>Peak longitudinal pitch</td><td className="num">{(result.peakPitchRad * DEG).toFixed(1)}°</td></tr>
              <tr><td>Peak lateral sway</td><td className="num">{(result.peakSwayRad * DEG).toFixed(1)}°</td></tr>
              <tr><td>Peak total swing angle</td><td className="num">{(result.peakTotalAngleRad * DEG).toFixed(1)}°</td></tr>
              <tr><td>Peak horizontal displacement</td><td className="num">{formatLength(result.peakDisplacementM, unitSystem)}</td></tr>
              <tr><td>Peak attachment reaction (horizontal)</td><td className="num">{formatForce(result.peakAttachmentReactionN, unitSystem)}</td></tr>
              <tr><td>Settling time (to 5%)</td><td className="num">{result.settlingTimeS === null ? <span className="badge-locked">undamped — does not settle</span> : `${result.settlingTimeS.toFixed(1)} s`}</td></tr>
              <tr><td>Minimum ground clearance</td><td className="num">{result.minGroundClearanceM === null ? <span className="badge-locked">not evaluated</span> : formatLength(result.minGroundClearanceM, unitSystem)}</td></tr>
            </tbody>
          </table>
          <SwingPlot result={result} />
          {result.warnings.length > 0 && (
            <div className="warnings-panel"><ul>{result.warnings.map((w, i) => <li key={i} className="warning">{w}</li>)}</ul></div>
          )}
          <ul className="assumptions">{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </>
      ))}
    </section>
  );
}

function SwingPlot({ result }: { result: PayloadPendulumResult }) {
  const t = result.history.tS;
  const a = result.history.totalAngleRad;
  if (t.length < 2) return null;
  const W = 100, H = 40;
  const tMax = t[t.length - 1] || 1;
  const aMax = Math.max(...a.map(Math.abs), 1e-6);
  const sx = (x: number) => (x / tMax) * W;
  const sy = (y: number) => H / 2 - (y / aMax) * (H / 2);
  const d = t.map((x, i) => `${i === 0 ? 'M' : 'L'} ${sx(x).toFixed(2)} ${sy(a[i]).toFixed(2)}`).join(' ');
  return (
    <svg className="mini-plot" viewBox={`-6 -4 ${W + 12} ${H + 12}`} role="img" aria-label="Swing angle vs time">
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="axis" />
      <line x1={0} y1={0} x2={0} y2={H} className="axis" />
      <path d={d} fill="none" stroke="#7c3aed" strokeWidth={0.7} />
      <text x={W / 2} y={H + 9} fontSize={3.5} fill="#64748b" textAnchor="middle">Time (s)</text>
      <text x={-4} y={2} fontSize={3.5} fill="#64748b">Swing angle</text>
    </svg>
  );
}
