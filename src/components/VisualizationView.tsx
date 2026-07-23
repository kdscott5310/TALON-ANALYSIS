import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../state/store';
import { validateScenario } from '../validation/validate';
import { buildSceneModel, buildTrajectory, type V3 } from '../visualizations/sceneData';
import { Scene3D, type ViewMode } from './Scene3D';
import { DISCLAIMER } from '../models/scenario';

/**
 * 3D visualization tab — Milestone 15.
 *
 * Engineering and customer/operator presentation modes, side/front/top/iso
 * view presets, orbit/pan/zoom, deflection scale, trajectory playback, and PNG
 * screenshot export. All geometry comes from the solver-derived scene model.
 */

type Preset = 'iso' | 'side' | 'front' | 'top';

function presetPosition(preset: Preset, center: V3, radius: number): [number, number, number] {
  const r = radius;
  switch (preset) {
    case 'side':
      return [center.x, center.y, r]; // look along -Z (side elevation)
    case 'front':
      return [center.x + r, center.y, 0.001]; // look along -X (down the line)
    case 'top':
      return [center.x, center.y + r, 0.001]; // look down
    case 'iso':
    default:
      return [center.x - r * 0.7, center.y + r * 0.6, r * 0.7];
  }
}

/**
 * Imperatively repositions the camera and orbit target when the view preset
 * changes. R3F applies the `camera` prop only at mount, and OrbitControls then
 * owns the camera, so preset changes must be driven through the live objects.
 */
function CameraController({ preset, center, radius }: { preset: Preset; center: V3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const [x, y, z] = presetPosition(preset, center, radius);
    camera.position.set(x, y, z);
    camera.up.set(0, 1, 0);
    if (controls) {
      controls.target.set(center.x, center.y, center.z);
      controls.update();
    } else {
      camera.lookAt(center.x, center.y, center.z);
    }
    camera.updateProjectionMatrix();
  }, [preset, center.x, center.y, center.z, radius, camera, controls]);
  return null;
}

export function VisualizationView() {
  const scenario = useAppStore((s) => s.scenario);
  const trolleyFrac = useAppStore((s) => s.trolleyPositionFrac);
  const setTrolleyFrac = useAppStore((s) => s.setTrolleyPosition);
  const validation = validateScenario(scenario);

  const [mode, setMode] = useState<ViewMode>('engineering');
  const [preset, setPreset] = useState<Preset>('iso');
  const [ortho, setOrtho] = useState(false);
  const [deflection, setDeflection] = useState(1);
  const [showForces, setShowForces] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // R3F measures the canvas on mount; when this tab mounts lazily the parent
  // size can settle a frame late, leaving the canvas at its 300×150 default.
  // Nudge the resize observer once after mount so it fills the container.
  useEffect(() => {
    const ids = [requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))];
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    return () => {
      ids.forEach(cancelAnimationFrame);
      window.clearTimeout(t);
    };
  }, []);

  const scene = useMemo(() => {
    if (!validation.isValid) return null;
    try {
      return buildSceneModel(scenario, trolleyFrac);
    } catch {
      return null;
    }
  }, [scenario, trolleyFrac, validation.isValid]);

  const trajectory = useMemo(() => (validation.isValid ? buildTrajectory(scenario) : null), [scenario, validation.isValid]);

  // Playback: advance playT, map to a world position along the trajectory.
  useEffect(() => {
    if (!playing || !trajectory) return;
    const duration = trajectory.tS[trajectory.tS.length - 1];
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setPlayT((prev) => {
        const next = prev + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, 33);
    return () => window.clearInterval(id);
  }, [playing, trajectory]);

  const trolleyOverride: V3 | null = useMemo(() => {
    if (!trajectory || (!playing && playT === 0)) return null;
    const { tS, points } = trajectory;
    if (playT <= tS[0]) return points[0];
    if (playT >= tS[tS.length - 1]) return points[points.length - 1];
    let lo = 0;
    let hi = tS.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tS[mid] <= playT) lo = mid;
      else hi = mid;
    }
    const f = (playT - tS[lo]) / (tS[hi] - tS[lo]);
    const a = points[lo];
    const b = points[hi];
    return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), z: a.z + f * (b.z - a.z) };
  }, [trajectory, playT, playing]);

  const camera = useMemo(() => {
    if (!scene) return { position: [10, 10, 10] as [number, number, number], center: { x: 0, y: 0, z: 0 }, radius: 10 };
    const center = { x: scene.bounds.maxX / 2, y: scene.bounds.maxY / 2, z: 0 };
    const radius = Math.max(scene.bounds.maxX, scene.bounds.maxY) * 1.1;
    return { position: presetPosition(preset, center, radius), center, radius };
  }, [scene, preset]);

  function screenshot() {
    const gl = glRef.current;
    if (!gl) return;
    // preserveDrawingBuffer keeps the last frame readable after render.
    const url = (gl.domElement as HTMLCanvasElement).toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.name.replace(/[^\w-]+/g, '_').slice(0, 50)}_3d.png`;
    a.click();
  }

  if (!validation.isValid) {
    return (
      <div className="single-col">
        <section className="results-panel">
          <h2>3D Visualization</h2>
          <p className="blocked">Visualization withheld — fix the input errors first.</p>
        </section>
      </div>
    );
  }

  const duration = trajectory ? trajectory.tS[trajectory.tS.length - 1] : 0;

  return (
    <div className="single-col viz3d">
      <div className="viz3d-controls no-print">
        <div className="viz3d-group">
          <span className="viz3d-label">Mode</span>
          <button className={mode === 'engineering' ? 'active' : ''} onClick={() => setMode('engineering')}>Engineering</button>
          <button className={mode === 'customer' ? 'active' : ''} onClick={() => setMode('customer')}>Customer / operator</button>
        </div>
        <div className="viz3d-group">
          <span className="viz3d-label">View</span>
          {(['iso', 'side', 'front', 'top'] as Preset[]).map((p) => (
            <button key={p} className={preset === p ? 'active' : ''} onClick={() => setPreset(p)}>{p}</button>
          ))}
          <label className="viz3d-check">
            <input type="checkbox" checked={ortho} onChange={(e) => setOrtho(e.target.checked)} /> ortho
          </label>
        </div>
        {mode === 'engineering' && (
          <div className="viz3d-group">
            <label className="viz3d-check">
              <input type="checkbox" checked={showForces} onChange={(e) => setShowForces(e.target.checked)} /> force vectors
            </label>
            <span className="viz3d-label">Deflection ×{deflection}</span>
            <input type="range" min={1} max={20} step={1} value={deflection} onChange={(e) => setDeflection(Number(e.target.value))} />
          </div>
        )}
        <div className="viz3d-group">
          <span className="viz3d-label">Trolley {(trolleyFrac * 100).toFixed(0)}%</span>
          <input type="range" min={0} max={1} step={0.01} value={trolleyFrac} onChange={(e) => { setTrolleyFrac(Number(e.target.value)); setPlayT(0); setPlaying(false); }} />
        </div>
        {trajectory && (
          <div className="viz3d-group">
            <button onClick={() => { if (playT >= duration) setPlayT(0); setPlaying((p) => !p); }}>
              {playing ? 'Pause' : playT >= duration && duration > 0 ? 'Replay' : 'Play run'}
            </button>
            <span className="viz3d-label">t {playT.toFixed(2)} / {duration.toFixed(2)} s</span>
            <input type="range" min={0} max={duration} step={duration / 300 || 1} value={Math.min(playT, duration)} onChange={(e) => { setPlaying(false); setPlayT(Number(e.target.value)); }} />
          </div>
        )}
        <div className="viz3d-group">
          <button onClick={screenshot}>Screenshot PNG</button>
        </div>
      </div>

      <div className="viz3d-canvas" ref={containerRef}>
        {scene ? (
          <Canvas
            key={ortho ? 'ortho' : 'persp'}
            orthographic={ortho}
            camera={{ position: camera.position, fov: 45, near: 0.1, far: camera.radius * 20, zoom: ortho ? Math.max(300 / camera.radius, 1) : 1 }}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            onCreated={(state) => {
              glRef.current = state.gl;
              state.gl.setClearColor('#dfeaf4');
              // Dev-only handle so a headless environment (no requestAnimationFrame)
              // can force a synchronous render for verification.
              if (import.meta.env.DEV) {
                (window as unknown as { __talon3d?: unknown }).__talon3d = state;
              }
            }}
          >
            <OrbitControls target={[camera.center.x, camera.center.y, camera.center.z]} makeDefault />
            <CameraController preset={preset} center={camera.center} radius={camera.radius} />
            <Scene3D scene={scene} mode={mode} deflectionScale={deflection} showForces={showForces} trolleyOverride={trolleyOverride} />
          </Canvas>
        ) : (
          <div className="side-view-error">Scene unavailable for the current inputs.</div>
        )}
      </div>

      <div className="viz3d-footer no-print">
        {mode === 'customer' ? (
          <p className="note">
            Operator preview — anticipated test-article path, zones, and clearance/sway envelopes.
            Preliminary planning aid only; not an authorization to conduct a test.
          </p>
        ) : (
          <p className="note">
            Engineering view — solved cable profile (solid), nominal chord (dashed), master-node
            force vectors, and clearance. Deflection scale is display-only. Reduced-order results;
            not certified.
          </p>
        )}
        {scene && scene.warnings.length > 0 && (
          <p className="note" style={{ color: 'var(--error)' }}>
            {scene.warnings.length} solver warning{scene.warnings.length === 1 ? '' : 's'} — see the Static/Dynamic tabs.
          </p>
        )}
        <p className="note" style={{ fontStyle: 'italic' }}>{DISCLAIMER}</p>
      </div>
    </div>
  );
}
