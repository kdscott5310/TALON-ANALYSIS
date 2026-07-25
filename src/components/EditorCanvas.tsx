/**
 * Editor canvas — Milestone 6C (read-only).
 *
 * Renders the active project's nodes and elements on a 2D elevation plane with
 * pan, zoom, a reference grid, and a coordinate-frame indicator. Selection is
 * visual only — no geometry is mutated (editing arrives in 6D).
 *
 * All geometry comes from the pure `buildEditorScene` mapping; this component
 * only maps world→screen and handles interaction. No engineering math (Rules
 * 2/7). SVG y increases downward, so world z (up) is drawn as -z.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { buildEditorScene, type EditorScene, type P2 } from '../visualizations/editorScene';
import type { NodeRole } from '../core/coordinates';
import type { ElementType } from '../core/elements';

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Selection = { kind: 'node' | 'edge' | 'attachment'; id: string } | null;

const NODE_COLOR: Record<NodeRole, string> = {
  anchor: '#55606b',
  craneHook: '#145a8a',
  masterRing: '#145a8a',
  trolley: '#b91c1c',
  support: '#55606b',
  frameJoint: '#145a8a',
  sensorPoint: '#0f766e',
  payloadAttachment: '#7c3aed',
  brakeAttachment: '#ef4444',
  groundContact: '#55606b',
  generic: '#64748b',
};

function edgeColor(type: ElementType): string {
  if (type === 'cable' || type === 'elasticCable' || type === 'segmentedCable') return '#b45309';
  if (type === 'brakeForce') return '#f59e0b';
  if (type === 'supportElement') return '#55606b';
  if (type === 'truss' || type === 'rigidLink') return '#145a8a';
  return '#64748b';
}

/** SVG coordinates: world x stays x; world z (up) becomes -z. */
const sx = (p: P2) => p.x;
const sy = (p: P2) => -p.z;

/** Fits a view box to the scene bounds with padding; guards degenerate spans. */
function fitView(scene: EditorScene): ViewBox {
  const { minX, maxX, minZ, maxZ } = scene.bounds;
  const spanX = Math.max(maxX - minX, 1);
  const spanZ = Math.max(maxZ - minZ, 1);
  const pad = 0.12 * Math.max(spanX, spanZ);
  const w = spanX + 2 * pad;
  const h = spanZ + 2 * pad;
  // SVG y = -z, so the top edge corresponds to maxZ.
  return { x: minX - pad, y: -maxZ - pad, w, h };
}

export function EditorCanvas() {
  const project = useProjectStore((s) => s.project);
  const scene = useMemo(() => buildEditorScene(project), [project]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<ViewBox>(() => fitView(scene));
  const [selected, setSelected] = useState<Selection>(null);
  const fittedFor = useRef<string>('');
  const drag = useRef<{ active: boolean; lastX: number; lastY: number; moved: boolean }>({
    active: false,
    lastX: 0,
    lastY: 0,
    moved: false,
  });

  // Re-fit when the active project changes (new template, reset, reload).
  useEffect(() => {
    if (fittedFor.current !== project.id) {
      setView(fitView(scene));
      setSelected(null);
      fittedFor.current = project.id;
    }
  }, [project.id, scene]);

  const fit = useCallback(() => setView(fitView(scene)), [scene]);

  const zoomBy = useCallback((factor: number, cx?: number, cz?: number) => {
    setView((v) => {
      const w = v.w * factor;
      const h = v.h * factor;
      // Anchor the zoom on (cx, -cz) if given, else the view centre.
      const ax = cx ?? v.x + v.w / 2;
      const ay = cz !== undefined ? -cz : v.y + v.h / 2;
      return { x: ax - (ax - v.x) * factor, y: ay - (ay - v.y) * factor, w, h };
    });
  }, []);

  /** Client px → world plane coordinates. */
  const toWorld = useCallback((clientX: number, clientY: number): P2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = view.x + ((clientX - rect.left) / rect.width) * view.w;
    const svgY = view.y + ((clientY - rect.top) / rect.height) * view.h;
    return { x: svgX, z: -svgY };
  }, [view]);

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const w = toWorld(e.clientX, e.clientY);
      zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12, w.x, w.z);
    },
    [toWorld, zoomBy],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    const rect = svgRef.current!.getBoundingClientRect();
    setView((v) => ({
      ...v,
      x: v.x - (dx / rect.width) * v.w,
      y: v.y - (dy / rect.height) * v.h,
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // A background press with no drag clears the selection.
    if (drag.current.active && !drag.current.moved) setSelected(null);
    drag.current.active = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  // World-proportional sizing so marks stay legible at any zoom.
  const u = view.w;
  const nodeR = u * 0.008;
  const lineW = u * 0.003;
  const fontS = u * 0.016;

  const selectId = (kind: 'node' | 'edge' | 'attachment', id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected({ kind, id });
  };

  const selectedLabel = (() => {
    if (!selected) return 'None — click a node or element';
    if (selected.kind === 'node') {
      const n = scene.nodes.find((x) => x.id === selected.id);
      return n ? `Node · ${n.name} (${n.role}) — x ${n.p.x.toFixed(2)} m, z ${n.p.z.toFixed(2)} m` : selected.id;
    }
    if (selected.kind === 'edge') {
      const el = scene.edges.find((x) => x.id === selected.id);
      return el ? `Element · ${el.name} [${el.type}]${el.future ? ' — export only' : ''}` : selected.id;
    }
    const at = scene.attachments.find((x) => x.id === selected.id);
    return at ? `Element · ${at.name} [${at.type}]` : selected.id;
  })();

  return (
    <div className="editor-canvas-wrap">
      <div className="editor-toolbar no-print">
        <span className="viz3d-label">2D elevation — x downrange, z up</span>
        <span className="editor-toolbar-gap" />
        <button type="button" onClick={() => zoomBy(1 / 1.2)} title="Zoom in">＋</button>
        <button type="button" onClick={() => zoomBy(1.2)} title="Zoom out">－</button>
        <button type="button" onClick={fit} title="Fit to view">Fit</button>
      </div>

      {scene.empty ? (
        <p className="note">This project has no geometry to display.</p>
      ) : (
        <svg
          ref={svgRef}
          className="editor-canvas"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="img"
          aria-label="Fixture model 2D elevation"
        >
          <defs>
            <pattern
              id="editor-grid"
              width={gridStep(view.w)}
              height={gridStep(view.w)}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridStep(view.w)} 0 L 0 0 0 ${gridStep(view.w)}`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={lineW * 0.5}
              />
            </pattern>
          </defs>
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill="url(#editor-grid)"
          />

          {/* ground datum line at z = 0 */}
          <line
            x1={view.x}
            y1={0}
            x2={view.x + view.w}
            y2={0}
            stroke="#94a3b8"
            strokeWidth={lineW * 0.7}
            strokeDasharray={`${u * 0.02} ${u * 0.02}`}
          />

          {/* coordinate-frame markers */}
          {scene.frames.map((f) => (
            <g key={f.id} transform={`translate(${sx(f.p)} ${sy(f.p)})`}>
              <path
                d={`M ${-nodeR} 0 L ${nodeR} 0 M 0 ${-nodeR} L 0 ${nodeR}`}
                stroke="#0f766e"
                strokeWidth={lineW * 0.8}
              />
              <text x={nodeR * 1.4} y={-nodeR * 1.2} fontSize={fontS * 0.8} fill="#0f766e">
                {f.name}
              </text>
            </g>
          ))}

          {/* elements (two-node) */}
          {scene.edges.map((el) => {
            const on = selected?.kind === 'edge' && selected.id === el.id;
            return (
              <line
                key={el.id}
                x1={sx(el.a)}
                y1={sy(el.a)}
                x2={sx(el.b)}
                y2={sy(el.b)}
                stroke={on ? '#0ea5e9' : edgeColor(el.type)}
                strokeWidth={on ? lineW * 2.4 : lineW * 1.6}
                strokeDasharray={el.future ? `${u * 0.02} ${u * 0.015}` : undefined}
                style={{ cursor: 'pointer' }}
                onClick={selectId('edge', el.id)}
              >
                <title>{`${el.name} [${el.type}]`}</title>
              </line>
            );
          })}

          {/* single-node elements */}
          {scene.attachments.map((at) => {
            const on = selected?.kind === 'attachment' && selected.id === at.id;
            const r = nodeR * 0.9;
            return (
              <rect
                key={at.id}
                x={sx(at.p) - r}
                y={sy(at.p) - r}
                width={r * 2}
                height={r * 2}
                fill={on ? '#0ea5e9' : '#8a6d1a'}
                opacity={0.85}
                style={{ cursor: 'pointer' }}
                onClick={selectId('attachment', at.id)}
              >
                <title>{`${at.name} [${at.type}]`}</title>
              </rect>
            );
          })}

          {/* nodes */}
          {scene.nodes.map((n) => {
            const on = selected?.kind === 'node' && selected.id === n.id;
            return (
              <g key={n.id}>
                <circle
                  cx={sx(n.p)}
                  cy={sy(n.p)}
                  r={on ? nodeR * 1.5 : nodeR}
                  fill={NODE_COLOR[n.role]}
                  stroke={on ? '#0ea5e9' : '#ffffff'}
                  strokeWidth={on ? lineW * 1.6 : lineW * 0.8}
                  style={{ cursor: 'pointer' }}
                  onClick={selectId('node', n.id)}
                >
                  <title>{`${n.name} (${n.role})`}</title>
                </circle>
                <text x={sx(n.p) + nodeR * 1.4} y={sy(n.p) - nodeR * 0.8} fontSize={fontS} fill="#33414e">
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <p className="note editor-selection" role="status">
        Selected: {selectedLabel}
      </p>
    </div>
  );
}

/** Picks a round grid step so ~8–16 lines span the view. */
function gridStep(spanX: number): number {
  const target = spanX / 12;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const candidates = [1, 2, 5, 10].map((m) => m * pow);
  return candidates.find((c) => c >= target) ?? pow * 10;
}
