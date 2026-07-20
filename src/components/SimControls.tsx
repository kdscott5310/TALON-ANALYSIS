import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import { useDynamics } from '../state/useDynamics';

/**
 * Playback controls for the Milestone-3 simulation: play/pause and a
 * time scrubber. The playback time drives the animated trolley in the
 * side view (via trolleyPositionFrac) so the static results track the
 * animated position.
 */

/** Linear interpolation of a history channel at time t. */
function sampleAt(ts: number[], vals: number[], t: number): number {
  if (ts.length === 0) return 0;
  if (t <= ts[0]) return vals[0];
  if (t >= ts[ts.length - 1]) return vals[vals.length - 1];
  let lo = 0;
  let hi = ts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - ts[lo]) / (ts[hi] - ts[lo]);
  return vals[lo] + f * (vals[hi] - vals[lo]);
}

export function SimControls() {
  const scenario = useAppStore((s) => s.scenario);
  const simTime = useAppStore((s) => s.simTimeS);
  const setSimTime = useAppStore((s) => s.setSimTime);
  const setTrolleyPos = useAppStore((s) => s.setTrolleyPosition);
  const { result } = useDynamics(scenario);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const duration = result ? result.sim.finalTimeS : 0;

  // Keep the trolley marker synchronized with the playback time.
  useEffect(() => {
    if (!result) return;
    const x = sampleAt(result.sim.history.tS, result.sim.history.xM, simTime);
    setTrolleyPos(x / scenario.site.horizontalSpanM);
  }, [simTime, result, scenario.site.horizontalSpanM, setTrolleyPos]);

  // Playback driver. setInterval (not requestAnimationFrame) so playback
  // keeps advancing when the tab is backgrounded or the pane is hidden.
  useEffect(() => {
    if (!playing || duration <= 0) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = ((now - last) / 1000) * speed;
      last = now;
      const st = useAppStore.getState();
      const next = st.simTimeS + dt;
      if (next >= duration) {
        st.setSimTime(duration);
        setPlaying(false);
      } else {
        st.setSimTime(next);
      }
    }, 33);
    return () => window.clearInterval(id);
  }, [playing, speed, duration]);

  if (!result) return null;

  const clampedTime = Math.min(simTime, duration);

  return (
    <div className="sim-controls">
      <button
        onClick={() => {
          if (!playing && clampedTime >= duration) setSimTime(0);
          setPlaying(!playing);
        }}
      >
        {playing ? 'Pause' : clampedTime >= duration && duration > 0 ? 'Replay' : 'Play'}
      </button>
      <label className="speed-select">
        Speed{' '}
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          <option value={0.25}>0.25×</option>
          <option value={1}>1×</option>
          <option value={4}>4×</option>
        </select>
      </label>
      <label className="time-scrub">
        t = {clampedTime.toFixed(2)} s / {duration.toFixed(2)} s
        <input
          type="range"
          min={0}
          max={duration}
          step={duration > 0 ? duration / 500 : 1}
          value={clampedTime}
          onChange={(e) => {
            setPlaying(false);
            setSimTime(Number(e.target.value));
          }}
        />
      </label>
    </div>
  );
}
