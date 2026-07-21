/**
 * Materials and element types — Milestone 6.
 *
 * Element definitions are pure data: node references plus provenance-carrying
 * dimensional quantities. No solver logic (Rule 7), so the same definitions
 * serve the v1 adapter, the M8 nonlinear cable solver, the M11 lateral
 * dynamics model, and any future FE assembly.
 *
 * Element types marked FUTURE are declared so the schema is forward-compatible
 * and so models can be *exported* to an external solver, but TALON does not
 * analyze them and must not imply that it does (Rule 11).
 */

import type { Quantity } from './provenance';

export interface Material {
  id: string;
  name: string;
  /** Free-text class, e.g. 'HMPE', 'galvanized wire rope', '6061-T6'. */
  category?: string;
  elasticModulus?: Quantity<'pressure'>;
  density?: Quantity<'density'>;
  thermalExpansion?: Quantity<'thermalExpansion'>;
  yieldStrength?: Quantity<'pressure'>;
  ultimateStrength?: Quantity<'pressure'>;
  temperatureLimit?: Quantity<'temperature'>;
  notes?: string;
}

/** Element types analyzed or represented by the platform. */
export type ElementType =
  // implemented / representable now
  | 'cable'
  | 'elasticCable'
  | 'segmentedCable'
  | 'truss'
  | 'rigidLink'
  | 'linearSpring'
  | 'nonlinearSpring'
  | 'viscousDamper'
  | 'pointMass'
  | 'rigidBody'
  | 'pulley'
  | 'brakeForce'
  | 'contactStop'
  | 'supportElement'
  // FUTURE — schema/export only, not analyzed by TALON
  | 'beam'
  | 'frame'
  | 'shellExport'
  | 'solidExport';

/** Types TALON can represent but does not analyze (export/groundwork only). */
export const FUTURE_ELEMENT_TYPES: ReadonlySet<ElementType> = new Set<ElementType>([
  'beam',
  'frame',
  'shellExport',
  'solidExport',
]);

export function isFutureElementType(type: ElementType): boolean {
  return FUTURE_ELEMENT_TYPES.has(type);
}

interface ElementBase {
  id: string;
  name?: string;
  type: ElementType;
  /** Catalog component this element was instantiated from (M7). */
  componentId?: string;
  materialId?: string;
  /** Local element frame, when results are reported in element coordinates. */
  csId?: string;
  notes?: string;
}

interface TwoNodeElement extends ElementBase {
  nodeIds: [string, string];
}

/** Properties shared by every cable formulation. */
interface CableProperties {
  /** Unstretched (manufactured) length, m — drives M8 compatibility. */
  unstretchedLength?: Quantity<'length'>;
  /** Axial stiffness EA, N. */
  axialStiffness?: Quantity<'force'>;
  linearMass?: Quantity<'linearDensity'>;
  diameter?: Quantity<'length'>;
  minBreakingStrength?: Quantity<'force'>;
  designFactor?: Quantity<'dimensionless'>;
  pretension?: Quantity<'force'>;
  /** Constructional stretch / creep allowance, dimensionless strain. */
  creepAllowance?: Quantity<'dimensionless'>;
  /** Structural damping ratio, dimensionless (M11). */
  dampingRatio?: Quantity<'dimensionless'>;
  /** Aerodynamic drag coefficient for wind loading (M11). */
  dragCoefficient?: Quantity<'dimensionless'>;
}

/** Tension-only cable analyzed with the Level-1 parabolic approximation. */
export interface CableElement extends TwoNodeElement, CableProperties {
  type: 'cable';
}

/** Cable analyzed with the Level-2 elastic-catenary formulation (M8). */
export interface ElasticCableElement extends TwoNodeElement, CableProperties {
  type: 'elasticCable';
}

/** Cable discretized into segments for the Level-2 nonlinear solver (M8). */
export interface SegmentedCableElement extends TwoNodeElement, CableProperties {
  type: 'segmentedCable';
  /** Number of segments; drives mesh-convergence studies. */
  segmentCount?: Quantity<'dimensionless'>;
}

export interface TrussElement extends TwoNodeElement {
  type: 'truss';
  area?: Quantity<'area'>;
  axialStiffness?: Quantity<'force'>;
}

export interface RigidLinkElement extends TwoNodeElement {
  type: 'rigidLink';
}

export interface LinearSpringElement extends TwoNodeElement {
  type: 'linearSpring';
  stiffness?: Quantity<'stiffness'>;
  freeLength?: Quantity<'length'>;
}

/** Spring defined by a force–displacement table (interpolated, M10). */
export interface NonlinearSpringElement extends TwoNodeElement {
  type: 'nonlinearSpring';
  /** Displacement samples, m. */
  displacementTable?: number[];
  /** Force samples, N, paired with `displacementTable`. */
  forceTable?: number[];
  freeLength?: Quantity<'length'>;
  /** How values between samples are computed. */
  interpolation?: 'linear' | 'pchip';
}

export interface ViscousDamperElement extends TwoNodeElement {
  type: 'viscousDamper';
  dampingCoefficient?: Quantity<'dampingCoefficient'>;
}

export interface PointMassElement extends ElementBase {
  type: 'pointMass';
  nodeIds: [string];
  mass?: Quantity<'mass'>;
  /** Rotary inertia about the travel axis, kg·m² (wheel inertia, M9). */
  rotaryInertia?: Quantity<'rotaryInertia'>;
}

/** Body with mass and rotary inertia about its own axes. */
export interface RigidBodyElement extends ElementBase {
  type: 'rigidBody';
  nodeIds: [string];
  mass?: Quantity<'mass'>;
  inertiaXX?: Quantity<'rotaryInertia'>;
  inertiaYY?: Quantity<'rotaryInertia'>;
  inertiaZZ?: Quantity<'rotaryInertia'>;
  /** Centre-of-gravity offset from the node, m. */
  cgOffset?: { x: number; y: number; z: number };
}

/** Sheave / snatch block redirecting a cable. */
export interface PulleyElement extends ElementBase {
  type: 'pulley';
  nodeIds: [string];
  /** Sheave pitch diameter, m. */
  sheaveDiameter?: Quantity<'length'>;
  /** Required sheave-to-rope diameter ratio (D:d). */
  minimumDRatio?: Quantity<'dimensionless'>;
  /** Efficiency, dimensionless (friction loss over the sheave). */
  efficiency?: Quantity<'dimensionless'>;
  frictionCoefficient?: Quantity<'dimensionless'>;
}

/**
 * Brake force element. The force law is a reference plus parameters so
 * Milestone 10 can add tabulated, measured, hydraulic, and eddy-current
 * curves without changing the element schema.
 */
export interface BrakeForceElement extends TwoNodeElement {
  type: 'brakeForce';
  lawId: string;
  parameters: Record<string, Quantity>;
  engagementPosition?: Quantity<'length'>;
  availableStroke?: Quantity<'length'>;
  /** Hardware force capacity, N. Missing => capacity check not evaluated. */
  forceCapacity?: Quantity<'force'>;
  /** Energy capacity per cycle, J (M10 thermal checks). */
  energyCapacity?: Quantity<'energy'>;
}

/** Hard stop / backup arrestor / contact interface. */
export interface ContactStopElement extends TwoNodeElement {
  type: 'contactStop';
  /** Gap before contact engages, m. */
  gap?: Quantity<'length'>;
  /** Contact stiffness once engaged, N/m. */
  stiffness?: Quantity<'stiffness'>;
  /** Maximum permitted contact force, N. */
  forceCapacity?: Quantity<'force'>;
}

/** Ground/ballast/structural support with capacity, distinct from a boundary condition. */
export interface SupportElementDef extends ElementBase {
  type: 'supportElement';
  nodeIds: [string];
  /** Dead weight resisting uplift and providing friction, N. */
  deadWeight?: Quantity<'force'>;
  frictionCoefficient?: Quantity<'dimensionless'>;
  /** Rated horizontal capacity, N. */
  lateralCapacity?: Quantity<'force'>;
  /** Rated uplift capacity, N. */
  upliftCapacity?: Quantity<'force'>;
}

/** FUTURE — represented for export only; TALON does not analyze these. */
export interface FutureElement extends ElementBase {
  type: 'beam' | 'frame' | 'shellExport' | 'solidExport';
  nodeIds: [string, string];
  notes?: string;
}

export type Element =
  | CableElement
  | ElasticCableElement
  | SegmentedCableElement
  | TrussElement
  | RigidLinkElement
  | LinearSpringElement
  | NonlinearSpringElement
  | ViscousDamperElement
  | PointMassElement
  | RigidBodyElement
  | PulleyElement
  | BrakeForceElement
  | ContactStopElement
  | SupportElementDef
  | FutureElement;

/** Any cable formulation. */
export type AnyCableElement = CableElement | ElasticCableElement | SegmentedCableElement;

export function isCable(element: Element): element is AnyCableElement {
  return (
    element.type === 'cable' ||
    element.type === 'elasticCable' ||
    element.type === 'segmentedCable'
  );
}

export function isPointMass(element: Element): element is PointMassElement {
  return element.type === 'pointMass';
}

export function isBrakeForce(element: Element): element is BrakeForceElement {
  return element.type === 'brakeForce';
}

export function isPulley(element: Element): element is PulleyElement {
  return element.type === 'pulley';
}

/** Node ids referenced by an element. */
export function elementNodeIds(element: Element): readonly string[] {
  return element.nodeIds;
}
