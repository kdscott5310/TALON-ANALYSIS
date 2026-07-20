/**
 * Typed domain models for the CUFTS planner.
 * All numeric values are stored internally in SI base units:
 * meters, kilograms, newtons, m/s, degrees Celsius.
 *
 * Fields whose values require field measurement, manufacturer data, or
 * professional approval are documented as PROVISIONAL.
 */

export interface SiteGeometry {
  /** Horizontal distance, launch (high-point ground station) to brake anchor, m */
  horizontalSpanM: number;
  /** High point (master node) elevation above launch-station ground, m */
  highPointElevationM: number;
  /** Ground elevation of brake anchor relative to launch station ground, m (+up) */
  brakeAnchorElevationM: number;
  /** Horizontal offset of launch-side (backstay) anchor from high point, m */
  launchAnchorOffsetM: number;
  /** Brake zone length, m */
  brakeZoneLengthM: number;
  /** Capture zone length, m */
  captureZoneLengthM: number;
  /** Required minimum payload ground clearance, m */
  minGroundClearanceM: number;
}

export interface CableProperties {
  /** Descriptive label; material data is PROVISIONAL until manufacturer-verified */
  materialLabel: string;
  diameterM: number;
  /** Linear mass, kg/m — PROVISIONAL */
  linearMassKgPerM: number;
  /** Minimum breaking strength, N — PROVISIONAL, verify with manufacturer */
  minBreakingStrengthN: number;
  /** Desired design factor (MBS / max working tension) */
  designFactor: number;
  /** Initial pretension, N */
  pretensionN: number;
}

export interface TrolleyPayload {
  trolleyMassKg: number;
  testArticleMassKg: number;
  /** Payload vertical drop below trolley, m */
  payloadDropM: number;
  maxAllowableSpeedMps: number;
  /** Rolling-resistance coefficient (dimensionless) — PROVISIONAL */
  rollingResistanceCoeff: number;
  /** Aerodynamic drag area Cd*A, m^2 — PROVISIONAL */
  dragAreaM2: number;
  /** Trolley structural rating (max applied force), N — 0 = not entered */
  trolleyStructuralRatingN: number;
}

export interface CraneInputs {
  /** User-entered rated capacity at working radius, N — requires crane-company chart */
  ratedCapacityAtRadiusN: number;
  hookHeightM: number;
  hookRadiusM: number;
  /** Rigging + master ring + load cell mass, kg — PROVISIONAL */
  riggingMassKg: number;
  /** Preliminary dynamic amplification factor — PROVISIONAL */
  dynamicAmplificationFactor: number;
}

export interface AnchorInputs {
  blocksPerAnchor: number;
  /** Weight per ecology block, kg — PROVISIONAL, requires field verification */
  blockMassKg: number;
  /** Ground coefficient of friction — PROVISIONAL placeholder */
  groundFrictionCoefficient: number;
  slidingSafetyFactor: number;
}

/** Preliminary brake force-vs-stroke/velocity laws (Milestone 3). */
export type BrakeLaw = 'constant-force' | 'linear-ramp' | 'velocity-proportional';

export interface BrakeInputs {
  brakeType: 'hydraulic-sled' | 'shock-absorber-bank' | 'friction-rope' | 'eddy-current';
  maxDecelerationMps2: number;
  availableStrokeM: number;
  /** Selected preliminary brake law for the dynamic simulation */
  brakeLaw: BrakeLaw;
  /** Brake force parameter, N: constant force, or peak force at full ramp stroke */
  brakeForceN: number;
  /** Velocity-proportional coefficient c in F = c*v, N·s/m */
  velocityCoeffNsPerM: number;
  /** User-entered brake hardware capacity (max allowable force), N — 0 = not entered */
  brakeCapacityN: number;
}

export interface EnvironmentInputs {
  steadyCrosswindMps: number;
  gustMps: number;
  temperatureC: number;
  /** Wind component along the main-span track, m/s (+ = tailwind pushing trolley downhill) */
  alongTrackWindMps: number;
  /** Air density, kg/m^3 — default 1.225 (standard sea level) */
  airDensityKgPerM3: number;
}

export interface DynamicsSettings {
  /** Release position as fraction of main-leg span (0 = at master node) */
  releasePositionFrac: number;
  /** Release speed along the cable, m/s (0 = released from rest) */
  releaseSpeedMps: number;
  /** Numerical integration time step, s */
  timeStepS: number;
  /** Simulation time limit, s (termination guard) */
  maxSimTimeS: number;
}

export interface Scenario {
  /** Schema version for future migration */
  schemaVersion: 1;
  name: string;
  /** True when the scenario is an unverified example, not validated data */
  isUnverifiedExample: boolean;
  site: SiteGeometry;
  cable: CableProperties;
  trolley: TrolleyPayload;
  crane: CraneInputs;
  anchors: AnchorInputs;
  brake: BrakeInputs;
  environment: EnvironmentInputs;
  dynamics: DynamicsSettings;
}

export const DISCLAIMER =
  'This application provides preliminary engineering estimates. Final cable ' +
  'dynamics, crane loads, rigging design, anchors, trolley, braking system, ' +
  'wind limits, and operating procedures require validation by appropriately ' +
  'qualified engineers, crane representatives, rigging personnel, and ' +
  'site-safety authorities.';
