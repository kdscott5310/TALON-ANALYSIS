/**
 * Milestone 17 — 2D truss direct-stiffness solver + neutral FE export.
 *
 * Hand-calc benchmarks:
 *  - single axial bar: δ = P·L/(E·A), reaction = −P,
 *  - symmetric two-bar truss: member force = P/(2·sinθ),
 *  - a mechanism (under-constrained) is reported, never silently solved.
 */
import { describe, it, expect } from 'vitest';
import { exportNeutralFe, solveTruss, type TrussModel } from '../calculations/trussFEM';

describe('single axial bar', () => {
  // Horizontal bar node A(0,0) fixed, node B(L,0) with axial load P.
  const L = 2;
  const E = 200e9;
  const A = 0.001;
  const P = 10000;
  const model: TrussModel = {
    nodes: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: L, y: 0 },
    ],
    members: [{ id: 'm1', from: 'A', to: 'B', elasticModulus: E, area: A }],
    supports: [
      { nodeId: 'A', fixX: true, fixY: true },
      { nodeId: 'B', fixX: false, fixY: true }, // roller: allows x, fixes y
    ],
    loads: [{ nodeId: 'B', fx: P, fy: 0 }],
  };

  it('matches δ = P·L/(E·A)', () => {
    const r = solveTruss(model);
    expect(r.solved).toBe(true);
    const expected = (P * L) / (E * A);
    expect(r.displacements.B.ux).toBeCloseTo(expected, 12);
    expect(r.displacements.B.uy).toBeCloseTo(0, 12);
  });

  it('reports the axial force = P (tension) and reaction = −P', () => {
    const r = solveTruss(model);
    expect(r.members[0].axialForceN).toBeCloseTo(P, 6);
    expect(r.members[0].axialStressPa).toBeCloseTo(P / A, 3);
    expect(r.reactions.A.rx).toBeCloseTo(-P, 6);
  });
});

describe('symmetric two-bar truss', () => {
  // Two bars from top supports down to a common apex carrying a vertical load.
  // Supports at (−1, 1) and (1, 1); apex at (0, 0), hanging below them. Each
  // bar at 45°. A downward load P at the apex puts both bars in TENSION (they
  // hold the apex up), with force F = P/(2·sinθ).
  const E = 200e9;
  const A = 0.001;
  const P = 20000;
  const model: TrussModel = {
    nodes: [
      { id: 'L', x: -1, y: 1 },
      { id: 'R', x: 1, y: 1 },
      { id: 'C', x: 0, y: 0 },
    ],
    members: [
      { id: 'mL', from: 'L', to: 'C', elasticModulus: E, area: A },
      { id: 'mR', from: 'R', to: 'C', elasticModulus: E, area: A },
    ],
    supports: [
      { nodeId: 'L', fixX: true, fixY: true },
      { nodeId: 'R', fixX: true, fixY: true },
    ],
    loads: [{ nodeId: 'C', fx: 0, fy: -P }],
  };

  it('gives member force P/(2·sinθ) with θ=45°', () => {
    const r = solveTruss(model);
    expect(r.solved).toBe(true);
    const theta = Math.atan2(1, 1); // 45°
    const expected = P / (2 * Math.sin(theta));
    // Bars hold the hanging apex up under a downward load → tension (positive).
    expect(Math.abs(r.members[0].axialForceN)).toBeCloseTo(expected, 3);
    expect(r.members[0].axialForceN).toBeGreaterThan(0);
    // Symmetry: equal and opposite horizontal reactions, equal vertical.
    expect(r.reactions.L.ry).toBeCloseTo(r.reactions.R.ry, 6);
    expect(r.reactions.L.rx).toBeCloseTo(-r.reactions.R.rx, 6);
    // Vertical reactions carry the load.
    expect(r.reactions.L.ry + r.reactions.R.ry).toBeCloseTo(P, 3);
  });

  it('is deterministic', () => {
    expect(solveTruss(model).members[0].axialForceN).toBe(solveTruss(model).members[0].axialForceN);
  });
});

describe('failure handling', () => {
  it('reports a mechanism (under-constrained) instead of solving', () => {
    const model: TrussModel = {
      nodes: [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 1, y: 0 },
      ],
      members: [{ id: 'm', from: 'A', to: 'B', elasticModulus: 200e9, area: 0.001 }],
      // Only A pinned; B free in x with a y load → vertical mechanism.
      supports: [{ nodeId: 'A', fixX: true, fixY: true }],
      loads: [{ nodeId: 'B', fx: 0, fy: -1000 }],
    };
    const r = solveTruss(model);
    expect(r.solved).toBe(false);
    expect(r.failureReason).toMatch(/mechanism|singular/i);
  });

  it('rejects non-positive E or A rather than defaulting', () => {
    const model: TrussModel = {
      nodes: [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 1, y: 0 },
      ],
      members: [{ id: 'm', from: 'A', to: 'B', elasticModulus: 0, area: 0.001 }],
      supports: [
        { nodeId: 'A', fixX: true, fixY: true },
        { nodeId: 'B', fixX: false, fixY: true },
      ],
      loads: [{ nodeId: 'B', fx: 100, fy: 0 }],
    };
    expect(solveTruss(model).failureReason).toMatch(/E or A/);
  });
});

describe('neutral FE export', () => {
  it('exports a translatable neutral model honestly labeled', () => {
    const model: TrussModel = {
      nodes: [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 2, y: 0 },
      ],
      members: [{ id: 'm1', from: 'A', to: 'B', elasticModulus: 200e9, area: 0.001 }],
      supports: [{ nodeId: 'A', fixX: true, fixY: true }],
      loads: [{ nodeId: 'B', fx: 1000, fy: 0 }],
    };
    const fe = exportNeutralFe(model);
    expect(fe.format).toBe('talon-neutral-fe');
    expect(fe.elements[0].type).toBe('T2D2');
    expect(fe.restraints[0].dof).toEqual(['x', 'y']);
    expect(fe.loads[0].components).toEqual([1000, 0]);
    // Honest labeling: does not claim frames/3D/shells/solids.
    expect(fe.notes.join(' ')).toMatch(/not implemented/i);
  });
});
