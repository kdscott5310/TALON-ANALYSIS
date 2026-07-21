/**
 * Materials and element types — Milestone 6.
 *
 * Element definitions are pure data: geometry references (node ids), physical
 * properties as provenance-carrying `Quantity` values, and nothing else. No
 * solver logic lives here, so the same definitions serve the current
 * adapter-based solvers (M6), the nonlinear cable solver (M7), the coupled
 * dynamics model (M8), and any future FE assembly.
 *
 * Every property is a `Quantity`, so a missing rating stays missing all the
 * way into the results rather than defaulting to zero (Rule 2).
 */

import type { Quantity } from './provenance';

export interface Material {
  id: string;
  name: string;
  /** Free-text class, e.g. "HMPE", "galvanized steel wire rope", "6061-T6". */
  category?: string;
  /** Young's modulus, Pa. */
  elasticModulus?: Quantity;
  /** Mass density, kg/m^3. */
  density?: Quantity;
  /** Coefficient of thermal expansion, 1/K. */
  thermalExpansion?: Quantity;
  /** Yield / proof strength, Pa (structural members). */
  yieldStrength?: Quantity;
  /** Temperature limit, degC. */
  temperatureLimit?: Quantity;
  notes?: string;
}

export type ElementType =
  | 'cable'
  | 'truss'
  | 'rigidLink'
  | 'linearSpring'
  | 'viscousDamper'
  | 'pointMass'
  | 'brakeContact';

interface ElementBase {
  id: string;
  name?: string;
  type: ElementType;
  /** Optional catalog component this element was instantiated from (M9). */
  componentId?: string;
  materialId?: string;
  notes?: string;
}

/** Two-node elements share a connectivity shape. */
interface TwoNodeElement extends ElementBase {
  nodeIds: [string, string];
}

/**
 * Flexible tension-only cable. Carries everything the M7 nonlinear solver
 * needs; the M6 adapter uses only the subset the parabolic solver consumes.
 */
export interface CableElement extends TwoNodeElement {
  type: 'cable';
  /** Unstretched (manufactured) length, m. Drives the M7 compatibility solve. */
  unstretchedLength?: Quantity;
  /** Axial stiffness EA, N. */
  axialStiffness?: Quantity;
  /** Linear mass, kg/m. */
  linearMass?: Quantity;
  /** Diameter, m. */
  diameter?: Quantity;
  /** Minimum breaking strength, N. */
  minBreakingStrength?: Quantity;
  /** Design factor (MBS ÷ allowable working tension), dimensionless. */
  designFactor?: Quantity;
  /** Installed pretension, N. */
  pretension?: Quantity;
  /** Constructional stretch / creep allowance, dimensionless strain. */
  creepAllowance?: Quantity;
  /** Structural damping ratio, dimensionless (M8). */
  dampingRatio?: Quantity;
}

/** Axial-force member carrying tension and compression. */
export interface TrussElement extends TwoNodeElement {
  type: 'truss';
  /** Cross-sectional area, m^2. */
  area?: Quantity;
  /** Axial stiffness EA, N (overrides material × area when supplied). */
  axialStiffness?: Quantity;
}

/** Kinematically rigid connection between two nodes. */
export interface RigidLinkElement extends TwoNodeElement {
  type: 'rigidLink';
}

export interface LinearSpringElement extends TwoNodeElement {
  type: 'linearSpring';
  /** Stiffness, N/m. */
  stiffness?: Quantity;
  /** Unstretched free length, m. */
  freeLength?: Quantity;
}

export interface ViscousDamperElement extends TwoNodeElement {
  type: 'viscousDamper';
  /** Damping coefficient, N*s/m. */
  dampingCoefficient?: Quantity;
}

/** Lumped mass at a single node. */
export interface PointMassElement extends ElementBase {
  type: 'pointMass';
  nodeIds: [string];
  /** Mass, kg. */
  mass?: Quantity;
  /** Rotary inertia about the travel axis, kg*m^2 (wheel inertia, M8). */
  rotaryInertia?: Quantity;
}

/**
 * Brake / contact force element. The force law itself is deliberately kept as
 * a reference plus parameters so Milestone 10 can add tabulated, measured, and
 * physics-based curves without changing the element schema.
 */
export interface BrakeContactElement extends TwoNodeElement {
  type: 'brakeContact';
  /** Force-law identifier, e.g. 'constant-force' | 'linear-ramp' | … */
  lawId: string;
  /** Law parameters, each provenance-carrying. */
  parameters: Record<string, Quantity>;
  /** Engagement position along the travel path, m. */
  engagementPosition?: Quantity;
  /** Available stroke, m. */
  availableStroke?: Quantity;
  /** Hardware force capacity, N. Missing => capacity check not evaluated. */
  forceCapacity?: Quantity;
}

export type Element =
  | CableElement
  | TrussElement
  | RigidLinkElement
  | LinearSpringElement
  | ViscousDamperElement
  | PointMassElement
  | BrakeContactElement;

/** Node ids referenced by an element (1 for point mass, 2 otherwise). */
export function elementNodeIds(element: Element): readonly string[] {
  return element.nodeIds;
}

/** Narrowing helper used by adapters and future solvers. */
export function isCable(element: Element): element is CableElement {
  return element.type === 'cable';
}

export function isPointMass(element: Element): element is PointMassElement {
  return element.type === 'pointMass';
}

export function isBrakeContact(element: Element): element is BrakeContactElement {
  return element.type === 'brakeContact';
}
