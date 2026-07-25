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
import type {
  Constraint,
  ConstraintKind,
  DofMask,
  Load,
  LoadCase,
  LoadCaseKind,
  LoadCombination,
  Project,
  Support,
  SupportKind,
} from './model';
import { provisional } from './provenance';

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
  return normalizeReferences(pruneElements(project, new Set([elementId])));
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
  return normalizeReferences(pruneElements(withNode, removedElementIds));
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

/**
 * Prunes references that could dangle after a removal: load-case factors that
 * name a deleted load, load-combination terms that name a deleted load case,
 * and report links to deleted runs. Keeps `checkProjectIntegrity` clean.
 */
function normalizeReferences(project: Project): Project {
  const loadIds = new Set(project.loads.map((l) => l.id));
  const loadCases = project.loadCases.map((c) => ({
    ...c,
    factors: c.factors.filter((f) => loadIds.has(f.loadId)),
  }));
  const caseIds = new Set(loadCases.map((c) => c.id));
  const loadCombinations = project.loadCombinations.map((cb) => ({
    ...cb,
    terms: cb.terms.filter((t) => caseIds.has(t.loadCaseId)),
  }));
  const runIds = new Set(project.analysisRuns.map((r) => r.id));
  const reports = project.reports.map((r) => ({
    ...r,
    analysisRunIds: r.analysisRunIds.filter((id) => runIds.has(id)),
  }));
  return { ...project, loadCases, loadCombinations, reports };
}

// ── supports ───────────────────────────────────────────────────────────────

/**
 * Sets (or replaces) the support on a node. One support per node — re-setting a
 * node's support replaces the previous one rather than stacking.
 */
export function setSupport(
  project: Project,
  nodeId: string,
  spec: { kind: SupportKind; restrained: DofMask; csId?: string; name?: string },
): { project: Project; supportId: string } {
  if (!project.nodes.some((n) => n.id === nodeId)) {
    throw new Error('A support must attach to an existing node.');
  }
  const existing = project.supports.find((s) => s.nodeId === nodeId);
  const id = existing?.id ?? nextId('sup', project.supports.map((s) => s.id));
  const support: Support = {
    id,
    name: spec.name,
    nodeId,
    kind: spec.kind,
    restrained: { ...spec.restrained },
    csId: spec.csId ?? GLOBAL_CS_ID,
  };
  const supports = existing
    ? project.supports.map((s) => (s.id === id ? support : s))
    : [...project.supports, support];
  return { project: { ...project, supports }, supportId: id };
}

export function removeSupport(project: Project, supportId: string): Project {
  return { ...project, supports: project.supports.filter((s) => s.id !== supportId) };
}

// ── loads ──────────────────────────────────────────────────────────────────

/**
 * Adds a point-force load on a node. Components are frame-tagged (global by
 * default, Rule 6) and stored in SI newtons as provisional (unverified) values.
 */
export function addPointForceLoad(
  project: Project,
  spec: { nodeId: string; fxN: number; fzN: number; name?: string; csId?: string },
): { project: Project; loadId: string } {
  if (!project.nodes.some((n) => n.id === spec.nodeId)) {
    throw new Error('A load must attach to an existing node.');
  }
  const id = nextId('load', project.loads.map((l) => l.id));
  const load: Load = {
    id,
    name: spec.name ?? `Load ${project.loads.length + 1}`,
    kind: 'pointForce',
    nodeId: spec.nodeId,
    csId: spec.csId ?? GLOBAL_CS_ID,
    components: { x: provisional(spec.fxN, 'force'), z: provisional(spec.fzN, 'force') },
  };
  return { project: { ...project, loads: [...project.loads, load] }, loadId: id };
}

export function removeLoad(project: Project, loadId: string): Project {
  return normalizeReferences({ ...project, loads: project.loads.filter((l) => l.id !== loadId) });
}

// ── constraints ──────────────────────────────────────────────────────────────

export function addConstraint(
  project: Project,
  spec: { kind: ConstraintKind; nodeIds: string[]; pathElementId?: string; name?: string },
): { project: Project; constraintId: string } {
  const nodeSet = new Set(project.nodes.map((n) => n.id));
  if (spec.nodeIds.length === 0 || spec.nodeIds.some((id) => !nodeSet.has(id))) {
    throw new Error('A constraint must reference existing nodes.');
  }
  if (spec.pathElementId && !project.elements.some((e) => e.id === spec.pathElementId)) {
    throw new Error('A constraint path must reference an existing element.');
  }
  const id = nextId('con', project.constraints.map((c) => c.id));
  const constraint: Constraint = {
    id,
    name: spec.name,
    kind: spec.kind,
    nodeIds: [...spec.nodeIds],
    pathElementId: spec.pathElementId,
  };
  return { project: { ...project, constraints: [...project.constraints, constraint] }, constraintId: id };
}

export function removeConstraint(project: Project, constraintId: string): Project {
  return { ...project, constraints: project.constraints.filter((c) => c.id !== constraintId) };
}

// ── load cases & combinations ────────────────────────────────────────────────

export function addLoadCase(
  project: Project,
  spec: { name: string; kind?: LoadCaseKind; loadIds: string[] },
): { project: Project; loadCaseId: string } {
  const loadSet = new Set(project.loads.map((l) => l.id));
  if (spec.loadIds.some((id) => !loadSet.has(id))) {
    throw new Error('A load case must reference existing loads.');
  }
  const id = nextId('lc', project.loadCases.map((c) => c.id));
  const loadCase: LoadCase = {
    id,
    name: spec.name,
    kind: spec.kind ?? 'custom',
    factors: spec.loadIds.map((loadId) => ({ loadId, factor: 1 })),
  };
  return { project: { ...project, loadCases: [...project.loadCases, loadCase] }, loadCaseId: id };
}

export function removeLoadCase(project: Project, loadCaseId: string): Project {
  return normalizeReferences({
    ...project,
    loadCases: project.loadCases.filter((c) => c.id !== loadCaseId),
  });
}

/**
 * Adds a user-defined load combination (unit factors). No building-code
 * combination is ever assumed — `standard` is only ever set when the user
 * explicitly selects one (not here).
 */
export function addLoadCombination(
  project: Project,
  spec: { name: string; loadCaseIds: string[] },
): { project: Project; combinationId: string } {
  const caseSet = new Set(project.loadCases.map((c) => c.id));
  if (spec.loadCaseIds.some((id) => !caseSet.has(id))) {
    throw new Error('A load combination must reference existing load cases.');
  }
  const id = nextId('combo', project.loadCombinations.map((c) => c.id));
  const combination: LoadCombination = {
    id,
    name: spec.name,
    terms: spec.loadCaseIds.map((loadCaseId) => ({ loadCaseId, factor: 1 })),
  };
  return {
    project: { ...project, loadCombinations: [...project.loadCombinations, combination] },
    combinationId: id,
  };
}

export function removeLoadCombination(project: Project, combinationId: string): Project {
  return {
    ...project,
    loadCombinations: project.loadCombinations.filter((c) => c.id !== combinationId),
  };
}
