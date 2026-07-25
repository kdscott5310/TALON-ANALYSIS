/**
 * Editor scene mapping — Milestone 6C.
 *
 * PURE Project → 2D-drawables mapping for the fixture-editor canvas. It resolves
 * every node into the global frame and projects onto the elevation plane
 * (global x = downrange → horizontal, global z = up → vertical), matching the
 * v1 side view. It performs NO engineering math and imports NO React (Rules
 * 2/7): it only reads model geometry and returns world-space primitives the
 * canvas draws. Screen mapping, pan/zoom, and selection live in the component.
 *
 * y (lateral / out-of-plane) is intentionally dropped for this 2D plane; the
 * CUFTS template is planar (y = 0) until the M11 lateral model.
 */
import type { Project } from '../core/model';
import {
  globalPosition,
  pointToGlobal,
  ZERO,
  type CoordinateSystem,
  type CoordinateSystemKind,
  type ModelNode,
  type NodeRole,
} from '../core/coordinates';
import { elementNodeIds, isFutureElementType, type Element, type ElementType } from '../core/elements';

/** A point on the 2D elevation plane, in world metres. */
export interface P2 {
  /** Downrange (global x), m. */
  x: number;
  /** Elevation (global z), m. */
  z: number;
}

export interface EditorNode {
  id: string;
  name: string;
  role: NodeRole;
  p: P2;
}

export interface EditorEdge {
  id: string;
  name: string;
  type: ElementType;
  /** True for schema/export-only element types TALON does not analyze (Rule 11). */
  future: boolean;
  nodeIds: readonly string[];
  a: P2;
  b: P2;
}

/** A single-node element (point mass, ballast support, pulley…) drawn at its node. */
export interface EditorAttachment {
  id: string;
  name: string;
  type: ElementType;
  nodeId: string;
  p: P2;
}

export interface EditorFrame {
  id: string;
  name: string;
  kind: CoordinateSystemKind;
  /** Frame origin resolved into the global elevation plane. */
  p: P2;
}

export interface EditorBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface EditorScene {
  nodes: EditorNode[];
  edges: EditorEdge[];
  attachments: EditorAttachment[];
  frames: EditorFrame[];
  bounds: EditorBounds;
  /** True when there is no geometry to draw. */
  empty: boolean;
}

function plane(node: ModelNode, systems: readonly CoordinateSystem[]): P2 {
  const g = globalPosition(node, systems);
  return { x: g.x, z: g.z };
}

function framePlane(cs: CoordinateSystem, systems: readonly CoordinateSystem[]): P2 {
  // The frame's own origin in global coordinates is its local zero resolved up.
  const g = pointToGlobal(ZERO, cs.id, systems);
  return { x: g.x, z: g.z };
}

function boundsOf(points: P2[]): EditorBounds {
  if (points.length === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * Builds the 2D editor scene from a project. Deterministic and side-effect free:
 * the same project always yields an equal scene.
 */
export function buildEditorScene(project: Project): EditorScene {
  const systems = project.coordinateSystems;

  const nodePlane = new Map<string, P2>();
  const nodes: EditorNode[] = project.nodes.map((n) => {
    const p = plane(n, systems);
    nodePlane.set(n.id, p);
    return { id: n.id, name: n.name ?? n.id, role: n.role ?? 'generic', p };
  });

  const edges: EditorEdge[] = [];
  const attachments: EditorAttachment[] = [];

  for (const element of project.elements as Element[]) {
    const ids = elementNodeIds(element);
    const name = element.name ?? element.id;
    if (ids.length >= 2) {
      const a = nodePlane.get(ids[0]);
      const b = nodePlane.get(ids[1]);
      if (a && b) {
        edges.push({
          id: element.id,
          name,
          type: element.type,
          future: isFutureElementType(element.type),
          nodeIds: ids,
          a,
          b,
        });
      }
    } else if (ids.length === 1) {
      const p = nodePlane.get(ids[0]);
      if (p) attachments.push({ id: element.id, name, type: element.type, nodeId: ids[0], p });
    }
  }

  const frames: EditorFrame[] = systems.map((cs) => ({
    id: cs.id,
    name: cs.name,
    kind: cs.kind,
    p: framePlane(cs, systems),
  }));

  return {
    nodes,
    edges,
    attachments,
    frames,
    bounds: boundsOf(nodes.map((n) => n.p)),
    empty: nodes.length === 0,
  };
}
