/**
 * 2D truss direct-stiffness solver — Milestone 17 (FEA groundwork).
 *
 * A real linear-elastic 2D pin-jointed truss solver by the direct-stiffness
 * method. This is the first genuine finite-element groundwork; it is honestly
 * scoped: pin-jointed axial members only, small displacement, linear elastic.
 * Frames (bending), 3D, shells, solids, contact, and plasticity are NOT
 * implemented and are documented as future external-solver integrations
 * (Rule 11 — TALON never claims FEA it does not have).
 *
 * Each node has 2 DOF (ux, uy). Member local stiffness in global coordinates:
 *
 *   k = (EA/L) · [ c²   cs  −c²  −cs
 *                  cs   s²  −cs  −s²
 *                 −c²  −cs   c²   cs
 *                 −cs  −s²   cs   s² ]      c = cosθ, s = sinθ
 *
 * Solve K·u = f on the free DOF (supports removed), then recover reactions and
 * member axial forces. Determinism and dimensional consistency are tested; the
 * classic hand-calc benchmarks (single bar, symmetric two-bar) are verified.
 */

export interface TrussNode {
  id: string;
  x: number;
  y: number;
}

export interface TrussMember {
  id: string;
  from: string;
  to: string;
  /** Young's modulus, Pa. */
  elasticModulus: number;
  /** Cross-sectional area, m². */
  area: number;
}

export interface TrussSupport {
  nodeId: string;
  /** Restrain the x DOF. */
  fixX: boolean;
  /** Restrain the y DOF. */
  fixY: boolean;
}

export interface TrussLoad {
  nodeId: string;
  /** Force components, N. */
  fx: number;
  fy: number;
}

export interface TrussModel {
  nodes: TrussNode[];
  members: TrussMember[];
  supports: TrussSupport[];
  loads: TrussLoad[];
}

export interface MemberResult {
  id: string;
  /** Axial force, N (+ tension, − compression). */
  axialForceN: number;
  /** Axial stress, Pa. */
  axialStressPa: number;
  lengthM: number;
}

export interface TrussResult {
  /** Nodal displacements, m, keyed by node id → {ux, uy}. */
  displacements: Record<string, { ux: number; uy: number }>;
  /** Support reactions, N, keyed by node id → {rx, ry}. */
  reactions: Record<string, { rx: number; ry: number }>;
  members: MemberResult[];
  /** True when the free system was solvable (not a mechanism). */
  solved: boolean;
  assumptions: string[];
  warnings: string[];
  failureReason?: string;
}

const ASSUMPTIONS = [
  'T1: Pin-jointed truss — members carry axial force only, no bending.',
  'T2: Linear elastic, small displacement (geometry unchanged by loading).',
  'T3: 2D (two translational DOF per node).',
  'T4: This is groundwork, not a general FE package: frames/3D/shells/solids ' +
    'are future external-solver integrations, not implemented here.',
];

/** Solves a linear system A·x = b by Gaussian elimination with partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    // pivot
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) return null; // singular → mechanism
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function solveTruss(model: TrussModel): TrussResult {
  const warnings: string[] = [];
  const fail = (reason: string): TrussResult => ({
    displacements: {},
    reactions: {},
    members: [],
    solved: false,
    assumptions: ASSUMPTIONS,
    warnings: [reason],
    failureReason: reason,
  });

  const { nodes, members, supports, loads } = model;
  if (nodes.length < 2) return fail('A truss needs at least two nodes.');
  if (members.length < 1) return fail('A truss needs at least one member.');

  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  for (const m of members) {
    if (!nodeIndex.has(m.from) || !nodeIndex.has(m.to)) {
      return fail(`Member "${m.id}" references an unknown node.`);
    }
    if (!(m.elasticModulus > 0) || !(m.area > 0)) {
      return fail(`Member "${m.id}" has non-positive E or A (never defaulted).`);
    }
  }

  const nDof = nodes.length * 2;
  const K = Array.from({ length: nDof }, () => new Array<number>(nDof).fill(0));

  // Precompute member geometry.
  const geom = members.map((m) => {
    const a = nodes[nodeIndex.get(m.from)!];
    const b = nodes[nodeIndex.get(m.to)!];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    return { m, ai: nodeIndex.get(m.from)!, bi: nodeIndex.get(m.to)!, L, c: dx / L, s: dy / L };
  });
  for (const g of geom) {
    if (!(g.L > 0)) return fail(`Member "${g.m.id}" has zero length.`);
  }

  // Assemble global stiffness.
  for (const g of geom) {
    const k = (g.m.elasticModulus * g.m.area) / g.L;
    const { c, s } = g;
    const kl = [
      [c * c, c * s, -c * c, -c * s],
      [c * s, s * s, -c * s, -s * s],
      [-c * c, -c * s, c * c, c * s],
      [-c * s, -s * s, c * s, s * s],
    ].map((row) => row.map((v) => v * k));
    const dof = [g.ai * 2, g.ai * 2 + 1, g.bi * 2, g.bi * 2 + 1];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[dof[i]][dof[j]] += kl[i][j];
  }

  // Force vector.
  const F = new Array<number>(nDof).fill(0);
  for (const load of loads) {
    const i = nodeIndex.get(load.nodeId);
    if (i === undefined) return fail(`Load references unknown node "${load.nodeId}".`);
    F[i * 2] += load.fx;
    F[i * 2 + 1] += load.fy;
  }

  // Constrained DOF.
  const fixed = new Array<boolean>(nDof).fill(false);
  for (const sup of supports) {
    const i = nodeIndex.get(sup.nodeId);
    if (i === undefined) return fail(`Support references unknown node "${sup.nodeId}".`);
    if (sup.fixX) fixed[i * 2] = true;
    if (sup.fixY) fixed[i * 2 + 1] = true;
  }

  const freeDof: number[] = [];
  for (let i = 0; i < nDof; i++) if (!fixed[i]) freeDof.push(i);
  if (freeDof.length === 0) return fail('All DOF are restrained; nothing to solve.');

  // Reduced system.
  const Kff = freeDof.map((r) => freeDof.map((cc) => K[r][cc]));
  const Ff = freeDof.map((r) => F[r]);
  const uf = solveLinear(Kff, Ff);
  if (!uf) {
    return fail('Stiffness matrix is singular — the truss is a mechanism (under-constrained).');
  }

  // Full displacement vector.
  const u = new Array<number>(nDof).fill(0);
  freeDof.forEach((d, i) => (u[d] = uf[i]));

  const displacements: Record<string, { ux: number; uy: number }> = {};
  nodes.forEach((n, i) => (displacements[n.id] = { ux: u[i * 2], uy: u[i * 2 + 1] }));

  // Reactions R = K·u − F at fixed DOF.
  const reactions: Record<string, { rx: number; ry: number }> = {};
  for (const sup of supports) {
    const i = nodeIndex.get(sup.nodeId)!;
    let rx = 0;
    let ry = 0;
    for (let j = 0; j < nDof; j++) {
      rx += K[i * 2][j] * u[j];
      ry += K[i * 2 + 1][j] * u[j];
    }
    reactions[sup.nodeId] = { rx: rx - F[i * 2], ry: ry - F[i * 2 + 1] };
  }

  // Member axial forces: N = (EA/L)·(Δu·direction).
  const memberResults: MemberResult[] = geom.map((g) => {
    const ua = displacements[g.m.from];
    const ub = displacements[g.m.to];
    const elong = (ub.ux - ua.ux) * g.c + (ub.uy - ua.uy) * g.s;
    const axial = ((g.m.elasticModulus * g.m.area) / g.L) * elong;
    return {
      id: g.m.id,
      axialForceN: axial,
      axialStressPa: axial / g.m.area,
      lengthM: g.L,
    };
  });

  return {
    displacements,
    reactions,
    members: memberResults,
    solved: true,
    assumptions: ASSUMPTIONS,
    warnings,
  };
}

// ── neutral external-solver export ──────────────────────────────────────────

export interface NeutralFeModel {
  format: 'talon-neutral-fe';
  version: 1;
  dimension: 2;
  elementFamily: 'truss';
  nodes: { id: string; coords: [number, number] }[];
  elements: { id: string; type: 'T2D2'; nodes: [string, string]; E: number; A: number }[];
  restraints: { nodeId: string; dof: ('x' | 'y')[] }[];
  loads: { nodeId: string; components: [number, number] }[];
  notes: string[];
}

/**
 * Exports the truss to a neutral FE model that a downstream translator can map
 * to CalculiX / OpenSees / Code_Aster. This build produces the neutral form
 * only; producing solver-specific decks and importing their results is a future
 * integration and is NOT represented as a completed capability.
 */
export function exportNeutralFe(model: TrussModel): NeutralFeModel {
  return {
    format: 'talon-neutral-fe',
    version: 1,
    dimension: 2,
    elementFamily: 'truss',
    nodes: model.nodes.map((n) => ({ id: n.id, coords: [n.x, n.y] })),
    elements: model.members.map((m) => ({
      id: m.id,
      type: 'T2D2',
      nodes: [m.from, m.to],
      E: m.elasticModulus,
      A: m.area,
    })),
    restraints: model.supports.map((s) => ({
      nodeId: s.nodeId,
      dof: [...(s.fixX ? (['x'] as const) : []), ...(s.fixY ? (['y'] as const) : [])],
    })),
    loads: model.loads.map((l) => ({ nodeId: l.nodeId, components: [l.fx, l.fy] })),
    notes: [
      'Neutral FE model for external translation only.',
      'TALON solves 2D pin-jointed trusses internally; frames/3D/shells/solids are ' +
        'future external-solver integrations and are not implemented.',
    ],
  };
}
