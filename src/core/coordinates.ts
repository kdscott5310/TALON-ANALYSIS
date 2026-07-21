/**
 * Coordinate systems and frame-tagged vectors — Milestone 6.
 *
 * Governance Rule 6 requires every calculated result to state its coordinate
 * system, so vector results are structurally incapable of omitting it: a
 * `FrameVector` carries the id of the frame it is expressed in.
 *
 * GLOBAL FRAME (right-handed, SI metres)
 *   x — downrange, positive from the launch station toward the capture end
 *   y — lateral / out-of-plane, positive left of the downrange axis
 *   z — vertical, positive up, zero at the launch-station ground datum
 */

import type { Provenance } from './provenance';

/** Frame kinds required by the platform specification. */
export type CoordinateSystemKind =
  | 'global'
  | 'localElement'
  | 'crane'
  | 'trolleyPath'
  | 'wind'
  | 'payloadBody'
  | 'sensor'
  | 'customerRange';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const norm = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const distance = (a: Vec3, b: Vec3): number => norm(sub(a, b));

/**
 * A reference frame.
 *
 * Rotation is represented as an explicit 3×3 direction-cosine matrix or `null`
 * for identity. `null` means "no rotation applied", recorded deliberately so a
 * later milestone can add rotated frames without ambiguity about what older
 * models meant (Rule 3 — nothing implied by omission).
 */
export interface CoordinateSystem {
  id: string;
  name: string;
  kind: CoordinateSystemKind;
  /** Origin expressed in the parent frame (global when `parentId` is absent), m. */
  origin: Vec3;
  /** Row-major 3×3 direction cosines mapping this frame → parent, or null (identity). */
  rotation: readonly [Vec3, Vec3, Vec3] | null;
  parentId?: string;
  description?: string;
}

export const GLOBAL_CS_ID = 'cs-global';

export function globalCoordinateSystem(): CoordinateSystem {
  return {
    id: GLOBAL_CS_ID,
    name: 'Global',
    kind: 'global',
    origin: ZERO,
    rotation: null,
    description:
      'x downrange, y lateral (left positive), z up; origin at the launch-station ground datum.',
  };
}

/** A vector that knows which frame it is expressed in (Rule 6). */
export interface FrameVector {
  components: Vec3;
  /** Id of the coordinate system the components are expressed in. */
  frameId: string;
  /** SI unit label of the components, e.g. 'N', 'm', 'm/s'. */
  unit: string;
  provenance?: Provenance;
}

export function frameVector(
  components: Vec3,
  frameId: string,
  unit: string,
  provenance?: Provenance,
): FrameVector {
  return { components, frameId, unit, provenance };
}

/** Rotates a vector from a frame into its parent frame. */
function toParent(v: Vec3, cs: CoordinateSystem): Vec3 {
  if (!cs.rotation) return v;
  const [r0, r1, r2] = cs.rotation;
  return {
    x: r0.x * v.x + r0.y * v.y + r0.z * v.z,
    y: r1.x * v.x + r1.y * v.y + r1.z * v.z,
    z: r2.x * v.x + r2.y * v.y + r2.z * v.z,
  };
}

/** Resolves a point expressed in `csId` into global coordinates. */
export function pointToGlobal(
  point: Vec3,
  csId: string,
  systems: readonly CoordinateSystem[],
): Vec3 {
  let current = systems.find((c) => c.id === csId);
  if (!current) throw new Error(`Unknown coordinate system "${csId}".`);
  let result = point;
  const seen = new Set<string>();
  while (current && current.kind !== 'global') {
    if (seen.has(current.id)) {
      throw new Error(`Coordinate system "${current.id}" has a circular parent chain.`);
    }
    seen.add(current.id);
    result = add(current.origin, toParent(result, current));
    const parentId: string | undefined = current.parentId;
    if (!parentId) break;
    const parent: CoordinateSystem | undefined = systems.find((c) => c.id === parentId);
    if (!parent) throw new Error(`Unknown parent coordinate system "${parentId}".`);
    current = parent;
  }
  return result;
}

/** Resolves a direction (no translation) expressed in `csId` into global axes. */
export function directionToGlobal(
  direction: Vec3,
  csId: string,
  systems: readonly CoordinateSystem[],
): Vec3 {
  let current = systems.find((c) => c.id === csId);
  if (!current) throw new Error(`Unknown coordinate system "${csId}".`);
  let result = direction;
  const seen = new Set<string>();
  while (current && current.kind !== 'global') {
    if (seen.has(current.id)) {
      throw new Error(`Coordinate system "${current.id}" has a circular parent chain.`);
    }
    seen.add(current.id);
    result = toParent(result, current);
    const parentId: string | undefined = current.parentId;
    if (!parentId) break;
    const parent: CoordinateSystem | undefined = systems.find((c) => c.id === parentId);
    if (!parent) throw new Error(`Unknown parent coordinate system "${parentId}".`);
    current = parent;
  }
  return result;
}

/**
 * Structural node. DOF layout is implied by attached elements and supports;
 * the FE-oriented DOF numbering arrives with the M17 analysis layer.
 */
export interface ModelNode {
  id: string;
  name?: string;
  /** Frame the position is expressed in. */
  csId: string;
  /** Position, m. */
  position: Vec3;
  /** What this node represents in the fixture. */
  role?: NodeRole;
  provenance?: Provenance;
}

/** What a node represents — drives visualization and reporting. */
export type NodeRole =
  | 'anchor'
  | 'craneHook'
  | 'masterRing'
  | 'trolley'
  | 'support'
  | 'frameJoint'
  | 'sensorPoint'
  | 'payloadAttachment'
  | 'brakeAttachment'
  | 'groundContact'
  | 'generic';

/** Resolves a node position into the global frame. */
export function globalPosition(node: ModelNode, systems: readonly CoordinateSystem[]): Vec3 {
  return pointToGlobal(node.position, node.csId, systems);
}
