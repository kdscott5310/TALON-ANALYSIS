/**
 * Project geometry edits — Milestone 6D.
 *
 * Pure, immutable operations that add / move / delete nodes and two-node
 * elements on a Project. Every operation returns a NEW project (the input is
 * never mutated) and preserves referential integrity: deleting a node cascades
 * to the elements, supports, constraints, loads, and moving bodies that
 * referenced it, so `checkProjectIntegrity` continues to pass.
 *
 * No React, no engineering math (Rules 2/7) — this is model bookkeeping only.
 * Intended for authoritative (custom) projects; the caller gates which projects
 * are editable.
 */
import { GLOBAL_CS_ID, vec3, type ModelNode, type NodeRole } from './coordinates';
import type { CableElement, Element, ElementType } from './elements';
import type { Project } from './model';

/** A point on the editor's elevation plane (global x, z); y is preserved/zero. */
export interface PlanePoint {
  x: number;
  z: number;
}

/** Next id of the form `${prefix}-<n>` not already used. */
function nextId(prefix: string, used: Iterable<string>): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of used) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${max + 1}`;
}

function allIds(project: Project): string[] {
  return [
    ...project.nodes.map((n) => n.id),
    ...project.elements.map((e) => e.id),
  ];
}

/** Adds a node at the given plane point. Returns the new project and node id. */
export function addNode(
  project: Project,
  point: PlanePoint,
  opts: { id?: string; name?: string; role?: NodeRole } = {},
): { project: Project; nodeId: string } {
  const id = opts.id ?? nextId('node', allIds(project));
  const index = project.nodes.length + 1;
  const node: ModelNode = {
    id,
    name: opts.name ?? `Node ${index}`,
    csId: GLOBAL_CS_ID,
    position: vec3(point.x, 0, point.z),
    role: opts.role ?? 'generic',
  };
  return { project: { ...project, nodes: [...project.nodes, node] }, nodeId: id };
}

/** Moves a node to a new plane point (its y is preserved). No-op if unknown. */
export function moveNode(project: Project, nodeId: string, point: PlanePoint): Project {
  let changed = false;
  const nodes = project.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    changed = true;
    return { ...n, position: { x: point.x, y: n.position.y, z: point.z } };
  });
  return changed ? { ...project, nodes } : project;
}

/**
 * Adds a two-node element between two existing, distinct nodes.
 * Defaults to a tension-only cable. Returns the new project and element id.
 */
export function addElement(
  project: Project,
  nodeAId: string,
  nodeBId: string,
  opts: { id?: string; name?: string; type?: ElementType } = {},
): { project: Project; elementId: string } {
  if (nodeAId === nodeBId) throw new Error('An element needs two distinct nodes.');
  const nodeIds = new Set(project.nodes.map((n) => n.id));
  if (!nodeIds.has(nodeAId) || !nodeIds.has(nodeBId)) {
    throw new Error('Both element endpoints must be existing nodes.');
  }
  const id = opts.id ?? nextId('elem', allIds(project));
  const type = opts.type ?? 'cable';
  // 6D creates cables; other two-node types are added by later packages.
  const element: CableElement = {
    id,
    name: opts.name ?? `Element ${project.elements.length + 1}`,
    type: type as 'cable',
    nodeIds: [nodeAId, nodeBId],
  };
  return { project: { ...project, elements: [...project.elements, element as Element] }, elementId: id };
}

/** Removes an element and any references to it (constraints, loads, bodies). */
export function deleteElement(project: Project, elementId: string): Project {
  if (!project.elements.some((e) => e.id === elementId)) return project;
  return pruneElements(project, new Set([elementId]));
}

/**
 * Removes a node and everything that depended on it: elements touching it,
 * supports on it, constraints/loads referencing it, and (transitively) the
 * references to any elements removed as a result.
 */
export function deleteNode(project: Project, nodeId: string): Project {
  if (!project.nodes.some((n) => n.id === nodeId)) return project;

  const removedElementIds = new Set(
    project.elements.filter((e) => e.nodeIds.includes(nodeId)).map((e) => e.id),
  );

  const nodes = project.nodes.filter((n) => n.id !== nodeId);
  const supports = project.supports.filter((s) => s.nodeId !== nodeId);
  const loads = project.loads.filter((l) => l.nodeId !== nodeId);
  const constraints = project.constraints.filter((c) => !c.nodeIds.includes(nodeId));

  const withNode: Project = { ...project, nodes, supports, loads, constraints };
  return pruneElements(withNode, removedElementIds);
}

/** Drops the given elements and every remaining reference to them. */
function pruneElements(project: Project, removeIds: Set<string>): Project {
  if (removeIds.size === 0) return project;
  const elements = project.elements.filter((e) => !removeIds.has(e.id));
  const constraints = project.constraints.filter(
    (c) => !c.pathElementId || !removeIds.has(c.pathElementId),
  );
  const loads = project.loads.filter((l) => !l.elementId || !removeIds.has(l.elementId));
  const movingBodies = project.movingBodies.filter((b) => !removeIds.has(b.pathElementId));
  return { ...project, elements, constraints, loads, movingBodies };
}
