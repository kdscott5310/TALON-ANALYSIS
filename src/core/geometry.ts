/**
 * Geometry primitives — Milestone 6.
 *
 * Nodes and coordinate systems for the generalized model. Positions are SI
 * (metres) in a right-handed 3D frame:
 *
 *   x — downrange, positive from the launch station toward the brake anchor
 *   y — lateral / out-of-plane, positive to the left of the downrange axis
 *   z — vertical, positive up, zero at the launch-station ground datum
 *
 * 2D planar models (the current CUFTS side elevation) simply hold y = 0.
 * Keeping three axes now is what allows the M8 lateral cable model and the
 * M11 3D views to reuse this data without a schema break.
 */

import type { Provenance } from './provenance';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

export function norm(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function distance(a: Vec3, b: Vec3): number {
  return norm(sub(a, b));
}

/**
 * A named reference frame. `global` is the model datum; local frames carry an
 * origin offset (rotations are reserved for a later milestone and are recorded
 * as identity today rather than being silently ignored).
 */
export interface CoordinateSystem {
  id: string;
  name: string;
  kind: 'global' | 'local';
  /** Origin expressed in the global frame, m. */
  origin: Vec3;
  /**
   * Rotation support is not implemented yet. `null` means "identity, no
   * rotation applied" — recorded explicitly so that a future milestone can add
   * rotations without ambiguity about what older models meant.
   */
  rotation: null;
}

export const GLOBAL_CS_ID = 'cs-global';

export function globalCoordinateSystem(): CoordinateSystem {
  return {
    id: GLOBAL_CS_ID,
    name: 'Global',
    kind: 'global',
    origin: ZERO,
    rotation: null,
  };
}

/**
 * Structural node. Degrees of freedom are implied by the elements and supports
 * attached to it; the FE-oriented DOF layout arrives with the analysis layer.
 */
export interface ModelNode {
  id: string;
  name?: string;
  /** Coordinate system the position is expressed in. */
  csId: string;
  /** Position, m. */
  position: Vec3;
  /** Optional provenance when the position is surveyed vs. assumed. */
  provenance?: Provenance;
}

/** Resolves a node position into the global frame. */
export function globalPosition(node: ModelNode, systems: CoordinateSystem[]): Vec3 {
  const cs = systems.find((c) => c.id === node.csId);
  if (!cs) {
    throw new Error(`Node "${node.id}" references unknown coordinate system "${node.csId}".`);
  }
  return cs.kind === 'global' ? node.position : add(cs.origin, node.position);
}
