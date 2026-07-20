import { useAppStore } from '../state/store';
import { useDynamics } from '../state/useDynamics';
import { mpsToMph, mToFt, nToLbf, GRAVITY } from '../units/units';

/**
 * Compact SVG time-history charts for the Milestone-3 simulation:
 * speed, position, acceleration, and brake force versus time.
 * A cursor line tracks the playback time.
 */

interface MiniChartProps {
  title: string;
  yLabel: string;
  xs: number[];
  ys: number[];
  cursorX?: number | null;
  /** Optional horizontal reference line (e.g., a limit) */
  refY?: number | null;
  refLabel?: string;
  color?: string;
}

const W = 320;
const H = 150;
const PAD_L = 46;
const PAD_R = 8;
const PAD_T = 20;
const PAD_B = 24;

/** Decimate to at most n points (uniform stride, keeps last point). */
function decimate(xs: number[], ys: number[], n = 400): [number[], number[]] {
  if (xs.length <= n) return [xs, ys];
  const stride = Math.ceil(xs.length / n);
  const ox: number[] = [];
  const oy: number[] = [];
  for (let i = 0; i < xs.length; i += stride) {
    ox.push(xs[i]);
    oy.push(ys[i]);
  }
  if (ox[ox.length - 1] !== xs[xs.length - 1]) {
    ox.push(xs[xs.length - 1]);
    oy.push(ys[ys.length - 1]);
  }
  return [ox, oy];
}

function MiniChart({ title, yLabel, xs, ys, cursorX, refY, refLabel, color = '#0369a1' }: MiniChartProps) {
  if (xs.length < 2) return null;
  const [dx, dy] = decimate(xs, ys);
  const xMin = dx[0];
  const xMax = dx[dx.length - 1];
  let yMin = Math.min(...dy, refY ?? Infinity);
  let yMax = Math.max(...dy, refY ?? -Infinity);
  if (yMax - yMin < 1e-9) {
    yMax += 1;
    yMin -= 1;
  }
  const spanY = yMax - yMin;
  yMax += spanY * 0.08;
  yMin -= spanY * 0.08;

  const X = (x: number) => PAD_L + ((x - xMin) / (xMax - xMin)) * (W - PAD_L - PAD_R);
  const Y = (y: number) => H - PAD_B - ((y - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const pts = dx.map((x, i) => `${X(x).toFixed(1)},${Y(dy[i]).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini-chart" role="img" aria-label={title}>
      <text x={PAD_L} y={12} className="chart-title">{title}</text>
      {/* axes */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} className="axis" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} className="axis" />
      {/* y ticks: min, mid, max */}
      {[yMin, (yMin + yMax) / 2, yMax].map((v, i) => (
        <g key={i}>
          <text x={PAD_L - 4} y={Y(v) + 3} className="tick" textAnchor="end">
            {Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(1)}
          </text>
        </g>
      ))}
      {/* x ticks: start, end */}
      <text x={PAD_L} y={H - 8} className="tick" textAnchor="middle">{xMin.toFixed(0)}</text>
      <text x={W - PAD_R} y={H - 8} className="tick" textAnchor="end">{xMax.toFixed(1)} s</text>
      <text x={8} y={PAD_T - 6} className="tick">{yLabel}</text>
      {/* reference limit line */}
      {refY !== null && refY !== undefined && refY >= yMin && refY <= yMax && (
        <g>
          <line x1={PAD_L} y1={Y(refY)} x2={W - PAD_R} y2={Y(refY)} className="ref-line" />
          {refLabel && (
            <text x={W - PAD_R} y={Y(refY) - 3} className="tick ref-lbl" textAnchor="end">{refLabel}</text>
          )}
        </g>
      )}
      {/* data */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} />
      {/* playback cursor */}
      {cursorX !== null && cursorX !== undefined && cursorX >= xMin && cursorX <= xMax && (
        <line x1={X(cursorX)} y1={PAD_T} x2={X(cursorX)} y2={H - PAD_B} className="cursor-line" />
      )}
    </svg>
  );
}

export function TimeHistoryCharts() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const simTime = useAppStore((s) => s.simTimeS);
  const { result } = useDynamics(scenario);

  if (!result) return null;
  const h = result.sim.history;
  const us = unitSystem === 'us';

  const speeds = us ? h.vMps.map(mpsToMph) : h.vMps;
  const positions = us ? h.xM.map(mToFt) : h.xM;
  const accelsG = h.aMps2.map((a) => a / GRAVITY);
  const brakeForces = us ? h.brakeForceN.map(nToLbf) : h.brakeForceN;
  const speedLimit = us
    ? mpsToMph(scenario.trolley.maxAllowableSpeedMps)
    : scenario.trolley.maxAllowableSpeedMps;
  const decelLimitG = scenario.brake.maxDecelerationMps2 / GRAVITY;

  return (
    <div className="charts-row">
      <MiniChart
        title="Speed vs time"
        yLabel={us ? 'mph' : 'm/s'}
        xs={h.tS}
        ys={speeds}
        cursorX={simTime}
        refY={speedLimit}
        refLabel="max allowable"
      />
      <MiniChart
        title="Position vs time"
        yLabel={us ? 'ft' : 'm'}
        xs={h.tS}
        ys={positions}
        cursorX={simTime}
        color="#15803d"
      />
      <MiniChart
        title="Acceleration vs time"
        yLabel="g"
        xs={h.tS}
        ys={accelsG}
        cursorX={simTime}
        refY={-decelLimitG}
        refLabel="decel limit"
        color="#b45309"
      />
      <MiniChart
        title="Brake force vs time"
        yLabel={us ? 'lbf' : 'N'}
        xs={h.tS}
        ys={brakeForces}
        cursorX={simTime}
        color="#b91c1c"
      />
    </div>
  );
}
