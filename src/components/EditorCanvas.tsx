/**
 * Editor canvas — Milestones 6C (view) + 6D (editing).
 *
 * Renders the active project's nodes and elements on a 2D elevation plane with
 * pan, zoom, a reference grid, and a coordinate-frame indicator. For custom
 * (authoritative-geometry) projects it also edits: add / move / delete nodes,
 * and connect two nodes into a cable — all committed immutably through the
 * project store. CUFTS projects stay read-only (their geometry is derived).
 *
 * All model→geometry mapping comes from the pure `buildEditorScene`; edits go
 * through the pure `projectEdits` operations. This component only maps
 * world↔screen and handles interaction (Rules 2/7). SVG y increases downward,
 * so world z (up) is drawn as -z.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useAppStore } from '../state/store';
import { buildEditorScene, type EditorScene, type P2 } from '../visualizations/editorScene';
import { isCustomProject } from '../core/templates/custom';
import { addElement, addNode, deleteElement, deleteNode, moveNode } from '../core/projectEdits';
import { FixtureInspector } from './FixtureInspector';
import { formatLength } from '../units/units';
import type { NodeRole } from '../core/coordinates';
import type { ElementType } from '../core/elements';

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Selection = { kind: 'node' | 'edge' | 'attachment'; id: string } | null;
type Mode = 'select' | 'add' | 'connect';

/** Grid to which placed / moved nodes snap, metres. */
const SNAP_M = 1;
const snap = (p: P2): P2 => ({ x: Math.round(p.x / SNAP_M) * SNAP_M, z: Math.round(p.z / SNAP_M) * SNAP_M });

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

const sx = (p: P2) => p.x;
const sy = (p: P2) => -p.z;
const lengthM = (a: P2, b: P2) => Math.hypot(b.x - a.x, b.z - a.z);

function fitView(scene: EditorScene): ViewBox {
  const { minX, maxX, minZ, maxZ } = scene.bounds;
  const spanX = Math.max(maxX - minX, 1);
  const spanZ = Math.max(maxZ - minZ, 1);
  const pad = 0.12 * Math.max(spanX, spanZ);
  return { x: minX - pad, y: -maxZ - pad, w: spanX + 2 * pad, h: spanZ + 2 * pad };
}

export function EditorCanvas() {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const editable = isCustomProject(project);
  const scene = useMemo(() => buildEditorScene(project), [project]);
  const nodePos = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n.p])), [scene]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<ViewBox>(() => fitView(scene));
  const [selected, setSelected] = useState<Selection>(null);
  const [mode, setMode] = useState<Mode>('select');
  const [pending, setPending] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<P2 | null>(null);
  const fittedFor = useRef<string>('');
  const dragNode = useRef<string | null>(null);
  const pan = useRef({ active: false, lastX: 0, lastY: 0, moved: false });

  // Non-select modes are only meaningful while editing.
  useEffect(() => {
    if (!editable && mode !== 'select') setMode('select');
  }, [editable, mode]);

  useEffect(() => {
    if (fittedFor.current !== project.id) {
      setView(fitView(scene));
      setSelected(null);
      setPending(null);
      setMode('select');
      fittedFor.current = project.id;
    }
  }, [project.id, scene]);

  const fit = useCallback(() => setView(fitView(scene)), [scene]);

  const zoomBy = useCallback((factor: number, cx?: number, cz?: number) => {
    setView((v) => {
      const ax = cx ?? v.x + v.w / 2;
      const ay = cz !== undefined ? -cz : v.y + v.h / 2;
      return { x: ax - (ax - v.x) * factor, y: ay - (ay - v.y) * factor, w: v.w * factor, h: v.h * factor };
    });
  }, []);

  const toWorld = useCallback(
    (clientX: number, clientY: number): P2 => {
      const rect = svgRef.current!.getBoundingClientRect();
      return {
        x: view.x + ((clientX - rect.left) / rect.width) * view.w,
        z: -(view.y + ((clientY - rect.top) / rect.height) * view.h),
      };
    },
    [view],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const w = toWorld(e.clientX, e.clientY);
      zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12, w.x, w.z);
    },
    [toWorld, zoomBy],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (editable && mode === 'add') {
        const p = snap(toWorld(e.clientX, e.clientY));
        const { project: next, nodeId } = addNode(project, p);
        setProject(next);
        setSelected({ kind: 'node', id: nodeId });
        return; // placing a node does not start a pan
      }
      pan.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [editable, mode, project, setProject, toWorld],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragNode.current) {
        setDragPos(snap(toWorld(e.clientX, e.clientY)));
        return;
      }
      if (!pan.current.active) return;
      const dx = e.clientX - pan.current.lastX;
      const dy = e.clientY - pan.current.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) pan.current.moved = true;
      pan.current.lastX = e.clientX;
      pan.current.lastY = e.clientY;
      const rect = svgRef.current!.getBoundingClientRect();
      setView((v) => ({ ...v, x: v.x - (dx / rect.width) * v.w, y: v.y - (dy / rect.height) * v.h }));
    },
    [toWorld],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragNode.current) {
        if (dragPos) setProject(moveNode(project, dragNode.current, dragPos));
        dragNode.current = null;
        setDragPos(null);
        return;
      }
      // A background press with no drag clears selection / cancels a pending connect.
      if (pan.current.active && !pan.current.moved) {
        setSelected(null);
        setPending(null);
      }
      pan.current.active = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    },
    [dragPos, project, setProject],
  );

  const onNodePointerDown = (id: string) => (e: React.PointerEvent) => {
    if (!editable || mode !== 'select') return;
    e.stopPropagation();
    dragNode.current = id;
    setDragPos(nodePos.get(id) ?? null);
  };

  const onNodeClick = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editable && mode === 'connect') {
      if (!pending) {
        setPending(id);
      } else if (pending !== id) {
        setProject(addElement(project, pending, id).project);
        setPending(null);
      }
      return;
    }
    setSelected({ kind: 'node', id });
  };

  const deleteSelected = () => {
    if (!selected) return;
    setProject(
      selected.kind === 'node' ? deleteNode(project, selected.id) : deleteElement(project, selected.id),
    );
    setSelected(null);
  };

  const liveP = (id: string): P2 => (dragNode.current === id && dragPos ? dragPos : nodePos.get(id)!);

  const u = view.w;
  const nodeR = u * 0.008;
  const lineW = u * 0.003;
  const fontS = u * 0.016;
  const step = gridStep(view.w);

  const selectionText = (() => {
    if (editable && mode === 'connect') {
      return pending
        ? `Connecting from ${nodeName(scene, pending)} — click another node`
        : 'Connect: click the first node';
    }
    if (editable && mode === 'add') return 'Add: click on the canvas to place a node (snaps to 1 m)';
    if (!selected) return 'None — click a node or element';
    if (selected.kind === 'node') {
      const n = scene.nodes.find((x) => x.id === selected.id);
      if (!n) return selected.id;
      const p = liveP(n.id);
      return `Node · ${n.name} — x ${formatLength(p.x, unitSystem)}, z ${formatLength(p.z, unitSystem)}`;
    }
    const el = scene.edges.find((x) => x.id === selected.id);
    if (el) {
      const len = lengthM(liveP(el.nodeIds[0]), liveP(el.nodeIds[1]));
      return `Element · ${el.name} [${el.type}] — length ${formatLength(len, unitSystem)}${el.future ? ' · export only' : ''}`;
    }
    const at = scene.attachments.find((x) => x.id === selected.id);
    return at ? `Element · ${at.name} [${at.type}]` : selected.id;
  })();

  return (
    <div className="editor-canvas-wrap">
      <div className="editor-toolbar no-print">
        <span className="viz3d-label">2D elevation — x downrange, z up</span>
        <span className="editor-toolbar-gap" />
        {editable && (
          <>
            <button type="button" className={mode === 'select' ? 'active' : ''} onClick={() => { setMode('select'); setPending(null); }}>Select</button>
            <button type="button" className={mode === 'add' ? 'active' : ''} onClick={() => { setMode('add'); setPending(null); }}>Add node</button>
            <button type="button" className={mode === 'connect' ? 'active' : ''} onClick={() => { setMode('connect'); setPending(null); }}>Connect</button>
            <button type="button" onClick={deleteSelected} disabled={!selected} title="Delete the selected node or element">Delete</button>
            <span className="editor-tool-sep" />
          </>
        )}
        <button type="button" onClick={() => zoomBy(1 / 1.2)} title="Zoom in">＋</button>
        <button type="button" onClick={() => zoomBy(1.2)} title="Zoom out">－</button>
        <button type="button" onClick={fit} title="Fit to view">Fit</button>
      </div>

      {!editable && (
        <p className="note">
          This project's geometry is derived from its template and is read-only.
          Create a “Custom node-and-element project” to edit geometry directly.
        </p>
      )}

      {scene.empty ? (
        <p className="note">This project has no geometry. {editable ? 'Use “Add node” to start.' : ''}</p>
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
          style={{ cursor: mode === 'add' ? 'crosshair' : undefined }}
        >
          <defs>
            <pattern id="editor-grid" width={step} height={step} patternUnits="userSpaceOnUse">
              <path d={`M ${step} 0 L 0 0 0 ${step}`} fill="none" stroke="#e2e8f0" strokeWidth={lineW * 0.5} />
            </pattern>
          </defs>
          <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#editor-grid)" />

          <line x1={view.x} y1={0} x2={view.x + view.w} y2={0} stroke="#94a3b8" strokeWidth={lineW * 0.7} strokeDasharray={`${u * 0.02} ${u * 0.02}`} />

          {scene.frames.map((f) => (
            <g key={f.id} transform={`translate(${sx(f.p)} ${sy(f.p)})`}>
              <path d={`M ${-nodeR} 0 L ${nodeR} 0 M 0 ${-nodeR} L 0 ${nodeR}`} stroke="#0f766e" strokeWidth={lineW * 0.8} />
              <text x={nodeR * 1.4} y={-nodeR * 1.2} fontSize={fontS * 0.8} fill="#0f766e">{f.name}</text>
            </g>
          ))}

          {scene.edges.map((el) => {
            const on = selected?.kind === 'edge' && selected.id === el.id;
            const a = liveP(el.nodeIds[0]);
            const b = liveP(el.nodeIds[1]);
            return (
              <line
                key={el.id}
                x1={sx(a)} y1={sy(a)} x2={sx(b)} y2={sy(b)}
                stroke={on ? '#0ea5e9' : edgeColor(el.type)}
                strokeWidth={on ? lineW * 2.4 : lineW * 1.6}
                strokeDasharray={el.future ? `${u * 0.02} ${u * 0.015}` : undefined}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (!(editable && mode !== 'select')) setSelected({ kind: 'edge', id: el.id }); }}
              >
                <title>{`${el.name} [${el.type}]`}</title>
              </line>
            );
          })}

          {scene.attachments.map((at) => {
            const on = selected?.kind === 'attachment' && selected.id === at.id;
            const p = liveP(at.nodeId);
            const r = nodeR * 0.9;
            return (
              <rect
                key={at.id}
                x={sx(p) - r} y={sy(p) - r} width={r * 2} height={r * 2}
                fill={on ? '#0ea5e9' : '#8a6d1a'} opacity={0.85}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (!(editable && mode !== 'select')) setSelected({ kind: 'attachment', id: at.id }); }}
              >
                <title>{`${at.name} [${at.type}]`}</title>
              </rect>
            );
          })}

          {project.supports.map((s) => {
            const p = nodePos.get(s.nodeId);
            if (!p) return null;
            return (
              <path
                key={s.id}
                d={`M ${sx(p)} ${sy(p) + nodeR * 1.2} L ${sx(p) - nodeR * 1.1} ${sy(p) + nodeR * 2.8} L ${sx(p) + nodeR * 1.1} ${sy(p) + nodeR * 2.8} Z`}
                fill="#0f766e"
                opacity={0.85}
              >
                <title>{`Support: ${s.kind}`}</title>
              </path>
            );
          })}

          {project.loads.map((l) => {
            if (!l.nodeId || l.kind !== 'pointForce') return null;
            const p = nodePos.get(l.nodeId);
            if (!p) return null;
            const fx = l.components?.x?.value ?? 0;
            const fz = l.components?.z?.value ?? 0;
            const mag = Math.hypot(fx, fz);
            if (mag === 0) return null;
            const len = u * 0.06;
            const ex = sx(p) + (fx / mag) * len;
            const ey = sy(p) - (fz / mag) * len;
            return (
              <g key={l.id}>
                <line x1={sx(p)} y1={sy(p)} x2={ex} y2={ey} stroke="#7c3aed" strokeWidth={lineW * 1.4} />
                <circle cx={ex} cy={ey} r={nodeR * 0.5} fill="#7c3aed">
                  <title>{l.name}</title>
                </circle>
              </g>
            );
          })}

          {scene.nodes.map((n) => {
            const on = selected?.kind === 'node' && selected.id === n.id;
            const isPending = pending === n.id;
            const p = liveP(n.id);
            return (
              <g key={n.id}>
                <circle
                  cx={sx(p)} cy={sy(p)} r={on || isPending ? nodeR * 1.5 : nodeR}
                  fill={NODE_COLOR[n.role]}
                  stroke={isPending ? '#f59e0b' : on ? '#0ea5e9' : '#ffffff'}
                  strokeWidth={on || isPending ? lineW * 1.8 : lineW * 0.8}
                  style={{ cursor: editable && mode === 'select' ? 'grab' : 'pointer' }}
                  onPointerDown={onNodePointerDown(n.id)}
                  onClick={onNodeClick(n.id)}
                >
                  <title>{`${n.name} (${n.role})`}</title>
                </circle>
                <text x={sx(p) + nodeR * 1.4} y={sy(p) - nodeR * 0.8} fontSize={fontS} fill="#33414e">{n.name}</text>
              </g>
            );
          })}
        </svg>
      )}

      <p className="note editor-selection" role="status">Selected: {selectionText}</p>

      {editable && (
        <FixtureInspector project={project} setProject={setProject} selection={selected} unitSystem={unitSystem} />
      )}
    </div>
  );
}

function nodeName(scene: EditorScene, id: string): string {
  return scene.nodes.find((n) => n.id === id)?.name ?? id;
}

/** Picks a round grid step so ~8–16 lines span the view. */
function gridStep(spanX: number): number {
  const target = spanX / 12;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  return [1, 2, 5, 10].map((m) => m * pow).find((c) => c >= target) ?? pow * 10;
}
