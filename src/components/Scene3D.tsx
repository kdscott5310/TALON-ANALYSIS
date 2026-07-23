import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import type { SceneModel, V3, ForceArrow } from '../visualizations/sceneData';

/**
 * 3D scene render — Milestone 15.
 *
 * Consumes a `SceneModel` (solver-derived geometry) and renders it. No
 * engineering calculation happens here (Rule 7): every position, cable, zone,
 * and force arrow comes straight from the scene model.
 *
 * Two presentation modes:
 *   engineering — nodes, dimensions, force vectors, tension/clearance labels,
 *                 undeformed chord vs. deformed cable.
 *   customer    — clean fixture, anticipated path, labeled zones, sway/clearance
 *                 envelopes, major warnings only.
 */

export type ViewMode = 'engineering' | 'customer';

const COLORS = {
  ground: '#7c8a5a',
  crane: '#8a6d1a',
  backstay: '#b45309',
  mainLoaded: '#b91c1c',
  mainUnloaded: '#94a3b8',
  chord: '#3b82f6',
  trolley: '#dc2626',
  payload: '#7c3aed',
  brakeZone: '#f59e0b',
  captureZone: '#ef4444',
  sway: '#22d3ee',
  forceBackstay: '#b45309',
  forceMain: '#0369a1',
  forceHook: '#15803d',
  node: '#1e3a5f',
  ok: '#15803d',
  bad: '#b91c1c',
};

const v = (p: V3): [number, number, number] => [p.x, p.y, p.z];

function CableLine({ points, color, width = 2, dashed = false }: {
  points: V3[];
  color: string;
  width?: number;
  dashed?: boolean;
}) {
  const pts = useMemo(() => points.map((p) => new THREE.Vector3(p.x, p.y, p.z)), [points]);
  return <Line points={pts} color={color} lineWidth={width} dashed={dashed} dashSize={3} gapSize={2} />;
}

function ForceVector({ arrow, color }: { arrow: ForceArrow; color: string }) {
  const dir = new THREE.Vector3(arrow.vector.x, arrow.vector.y, arrow.vector.z);
  const len = dir.length();
  if (len < 1e-6) return null;
  const origin = new THREE.Vector3(...v(arrow.origin));
  const helper = useMemo(
    () => new THREE.ArrowHelper(dir.clone().normalize(), origin, len, new THREE.Color(color), len * 0.18, len * 0.09),
    [arrow.origin.x, arrow.origin.y, arrow.vector.x, arrow.vector.y, len, color],
  );
  return <primitive object={helper} />;
}

function Label({ position, text, color = '#0f172a', bg = 'rgba(255,255,255,0.85)' }: {
  position: V3;
  text: string;
  color?: string;
  bg?: string;
}) {
  return (
    <Html position={v(position)} center distanceFactor={undefined} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color,
          background: bg,
          padding: '1px 5px',
          borderRadius: 3,
          whiteSpace: 'nowrap',
          transform: 'translateY(-14px)',
          border: '1px solid rgba(0,0,0,0.1)',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

/** Flat zone patch on the ground plane (XZ), at the given elevation. */
function ZonePatch({ startX, endX, halfZ, y, color, opacity }: {
  startX: number;
  endX: number;
  halfZ: number;
  y: number;
  color: string;
  opacity: number;
}) {
  const cx = (startX + endX) / 2;
  const w = Math.max(endX - startX, 0.1);
  return (
    <mesh position={[cx, y + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, halfZ * 2]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Scene3D({
  scene,
  mode,
  deflectionScale,
  showForces,
  trolleyOverride,
}: {
  scene: SceneModel;
  mode: ViewMode;
  deflectionScale: number;
  showForces: boolean;
  /** Optional world position to draw the animated trolley at (playback). */
  trolleyOverride?: V3 | null;
}) {
  const engineering = mode === 'engineering';
  const groundLen = scene.groundLengthX;
  const halfZ = scene.bounds.halfZ;

  // Apply deflection scale about the straight chord for the loaded cable, so
  // the sag can be exaggerated for visibility (display-only, labeled in UI).
  const scaledLoaded = useMemo(() => {
    const loaded = scene.cables.find((c) => c.kind === 'mainLoaded');
    if (!loaded || deflectionScale === 1) return loaded?.points ?? [];
    const a = loaded.points[0];
    const b = loaded.points[loaded.points.length - 1];
    return loaded.points.map((p) => {
      const t = (p.x - a.x) / (b.x - a.x || 1);
      const chordY = a.y + t * (b.y - a.y);
      return { x: p.x, y: chordY + (p.y - chordY) * deflectionScale, z: p.z };
    });
  }, [scene.cables, deflectionScale]);

  const trolley = trolleyOverride ?? scene.trolley.position;
  const payloadBottom: V3 = { x: trolley.x, y: trolley.y - scene.trolley.payloadDropM, z: trolley.z };

  return (
    <group>
      {/* lighting */}
      <ambientLight intensity={0.75} />
      <directionalLight position={[groundLen * 0.3, scene.bounds.maxY * 2, halfZ * 4]} intensity={0.8} />

      {/* ground plane */}
      <mesh position={[groundLen / 2, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[groundLen * 1.15, Math.max(halfZ * 4, 20)]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>

      {/* crane mast */}
      <Line
        points={[new THREE.Vector3(scene.craneBaseX, 0, 0), new THREE.Vector3(...v(scene.craneTop))]}
        color={COLORS.crane}
        lineWidth={5}
      />

      {/* anchors + master node markers */}
      {scene.nodes.map((n) => (
        <group key={n.id}>
          <mesh position={v(n.position)}>
            <sphereGeometry args={[Math.max(groundLen * 0.006, 0.6), 16, 16]} />
            <meshStandardMaterial color={COLORS.node} />
          </mesh>
          {engineering && <Label position={n.position} text={n.label} />}
        </group>
      ))}

      {/* cables: nominal chord (eng only), unloaded, loaded */}
      {engineering && (
        <CableLine
          points={[scene.craneTop, scene.nodes.find((n) => n.role === 'captureAnchor')!.position]}
          color={COLORS.chord}
          width={1.5}
          dashed
        />
      )}
      <CableLine points={scene.cables.find((c) => c.kind === 'backstay')!.points} color={COLORS.backstay} width={2.5} />
      {engineering && (
        <CableLine
          points={scene.cables.find((c) => c.kind === 'mainUnloaded')!.points}
          color={COLORS.mainUnloaded}
          width={1.5}
          dashed
        />
      )}
      <CableLine points={scaledLoaded} color={COLORS.mainLoaded} width={3} />

      {/* customer mode: anticipated path highlight */}
      {!engineering && (
        <CableLine points={scene.trolleyPath} color="#16a34a" width={2} dashed />
      )}

      {/* trolley + payload */}
      <mesh position={v(trolley)}>
        <boxGeometry args={[groundLen * 0.012, groundLen * 0.008, groundLen * 0.012]} />
        <meshStandardMaterial color={COLORS.trolley} />
      </mesh>
      <Line points={[new THREE.Vector3(...v(trolley)), new THREE.Vector3(...v(payloadBottom))]} color={COLORS.payload} lineWidth={2} />
      <mesh position={v(payloadBottom)}>
        <sphereGeometry args={[Math.max(groundLen * 0.007, 0.7), 16, 16]} />
        <meshStandardMaterial color={COLORS.payload} />
      </mesh>

      {/* zones */}
      {scene.zones.map((z) => (
        <group key={z.id}>
          <ZonePatch
            startX={z.startX}
            endX={z.endX}
            halfZ={z.halfWidthZ}
            y={scene.brakeGroundY}
            color={z.kind === 'brake' ? COLORS.brakeZone : COLORS.captureZone}
            opacity={0.5}
          />
          <Label position={{ x: (z.startX + z.endX) / 2, y: scene.brakeGroundY + 1, z: 0 }} text={z.label} />
        </group>
      ))}

      {/* sway corridor (customer mode) */}
      {!engineering && scene.swayCorridorHalfWidthM && (
        <ZonePatch
          startX={scene.craneBaseX}
          endX={scene.bounds.maxX}
          halfZ={scene.swayCorridorHalfWidthM}
          y={0}
          color={COLORS.sway}
          opacity={0.15}
        />
      )}

      {/* force vectors (engineering) */}
      {engineering && showForces && (
        <>
          <ForceVector arrow={scene.forces.find((f) => f.kind === 'backstay')!} color={COLORS.forceBackstay} />
          <ForceVector arrow={scene.forces.find((f) => f.kind === 'mainLeg')!} color={COLORS.forceMain} />
          <ForceVector arrow={scene.forces.find((f) => f.kind === 'hook')!} color={COLORS.forceHook} />
          <Label
            position={{ x: scene.craneTop.x, y: scene.craneTop.y + scene.bounds.maxY * 0.12, z: 0 }}
            text={`Hook ${Math.round(scene.peakHookLoadN)} N (DAF)`}
            color="#15803d"
          />
        </>
      )}

      {/* clearance callout */}
      <Label
        position={scene.trolley.payloadBottom}
        text={`clearance ${scene.clearance.minClearanceM.toFixed(1)} m`}
        color={scene.clearance.ok ? COLORS.ok : COLORS.bad}
        bg={scene.clearance.ok ? 'rgba(240,253,244,0.9)' : 'rgba(254,226,226,0.95)'}
      />
    </group>
  );
}
