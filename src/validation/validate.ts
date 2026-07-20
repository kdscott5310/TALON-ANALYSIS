import type { Scenario } from '../models/scenario';
import { ftToM, mphToMps } from '../units/units';

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  field: string;
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  /** True when no error-severity issues exist. Warnings do not block. */
  isValid: boolean;
}

const err = (field: string, message: string): ValidationIssue => ({
  severity: 'error',
  field,
  message,
});
const warn = (field: string, message: string): ValidationIssue => ({
  severity: 'warning',
  field,
  message,
});

function finitePositive(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/**
 * Validates a scenario. Errors indicate values that must not enter
 * calculations; warnings indicate values outside a reasonable
 * preliminary-design range.
 */
export function validateScenario(s: Scenario): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { site, cable, trolley, crane, anchors, brake, environment } = s;

  // ---- site geometry ----
  if (!finitePositive(site.horizontalSpanM))
    issues.push(err('site.horizontalSpanM', 'Horizontal span must be a positive number.'));
  else {
    if (site.horizontalSpanM < ftToM(500))
      issues.push(warn('site.horizontalSpanM', 'Span below 500 ft is outside the preliminary design range.'));
    if (site.horizontalSpanM > ftToM(2000))
      issues.push(warn('site.horizontalSpanM', 'Span above 2,000 ft is outside the preliminary design range.'));
  }

  if (!finitePositive(site.highPointElevationM))
    issues.push(err('site.highPointElevationM', 'High-point elevation must be a positive number.'));
  else {
    if (site.highPointElevationM < ftToM(25))
      issues.push(warn('site.highPointElevationM', 'High point below 25 ft is outside the preliminary design range.'));
    if (site.highPointElevationM > ftToM(250))
      issues.push(warn('site.highPointElevationM', 'High point above 250 ft is outside the preliminary design range.'));
  }

  if (!Number.isFinite(site.brakeAnchorElevationM))
    issues.push(err('site.brakeAnchorElevationM', 'Brake-anchor elevation must be a number.'));

  if (!finitePositive(site.launchAnchorOffsetM))
    issues.push(err('site.launchAnchorOffsetM', 'Launch-anchor offset must be a positive number.'));

  if (!finitePositive(site.brakeZoneLengthM))
    issues.push(err('site.brakeZoneLengthM', 'Brake-zone length must be a positive number.'));
  else if (site.brakeZoneLengthM >= site.horizontalSpanM)
    issues.push(err('site.brakeZoneLengthM', 'Brake zone cannot be longer than the main span.'));

  if (!finitePositive(site.captureZoneLengthM))
    issues.push(err('site.captureZoneLengthM', 'Capture-zone length must be a positive number.'));

  if (!Number.isFinite(site.minGroundClearanceM) || site.minGroundClearanceM < 0)
    issues.push(err('site.minGroundClearanceM', 'Minimum ground clearance must be zero or positive.'));

  if (
    finitePositive(site.highPointElevationM) &&
    finitePositive(site.horizontalSpanM) &&
    site.highPointElevationM > site.horizontalSpanM
  )
    issues.push(warn('site', 'High point exceeds horizontal span; approach angle is steeper than 45 degrees.'));

  // ---- cable ----
  if (!finitePositive(cable.diameterM))
    issues.push(err('cable.diameterM', 'Cable diameter must be a positive number.'));
  if (!finitePositive(cable.linearMassKgPerM))
    issues.push(err('cable.linearMassKgPerM', 'Cable linear mass must be a positive number.'));
  if (!finitePositive(cable.minBreakingStrengthN))
    issues.push(err('cable.minBreakingStrengthN', 'Minimum breaking strength must be a positive number.'));
  if (!finitePositive(cable.designFactor))
    issues.push(err('cable.designFactor', 'Design factor must be a positive number.'));
  else if (cable.designFactor < 5)
    issues.push(warn('cable.designFactor', 'Design factor below 5:1 is below the project safety target.'));
  if (!Number.isFinite(cable.pretensionN) || cable.pretensionN < 0)
    issues.push(err('cable.pretensionN', 'Pretension must be zero or positive.'));
  else if (
    finitePositive(cable.minBreakingStrengthN) &&
    finitePositive(cable.designFactor) &&
    cable.pretensionN > cable.minBreakingStrengthN / cable.designFactor
  )
    issues.push(warn('cable.pretensionN', 'Pretension exceeds MBS divided by the design factor.'));

  // ---- trolley ----
  if (!finitePositive(trolley.trolleyMassKg))
    issues.push(err('trolley.trolleyMassKg', 'Trolley mass must be a positive number.'));
  if (!Number.isFinite(trolley.testArticleMassKg) || trolley.testArticleMassKg < 0)
    issues.push(err('trolley.testArticleMassKg', 'Test-article mass must be zero or positive.'));
  if (!Number.isFinite(trolley.payloadDropM) || trolley.payloadDropM < 0)
    issues.push(err('trolley.payloadDropM', 'Payload drop must be zero or positive.'));
  if (!finitePositive(trolley.maxAllowableSpeedMps))
    issues.push(err('trolley.maxAllowableSpeedMps', 'Maximum allowable speed must be a positive number.'));
  else if (trolley.maxAllowableSpeedMps > mphToMps(77))
    issues.push(warn('trolley.maxAllowableSpeedMps', 'Speeds above ~77 mph exceed the frictionless ceiling for a 200 ft apex.'));
  if (!Number.isFinite(trolley.rollingResistanceCoeff) || trolley.rollingResistanceCoeff < 0)
    issues.push(err('trolley.rollingResistanceCoeff', 'Rolling-resistance coefficient must be zero or positive.'));
  else if (trolley.rollingResistanceCoeff > 0.05)
    issues.push(warn('trolley.rollingResistanceCoeff', 'Rolling resistance above 0.05 is unusually high for cable wheels; verify.'));
  if (!Number.isFinite(trolley.dragAreaM2) || trolley.dragAreaM2 < 0)
    issues.push(err('trolley.dragAreaM2', 'Drag area (Cd·A) must be zero or positive.'));
  if (!Number.isFinite(trolley.trolleyStructuralRatingN) || trolley.trolleyStructuralRatingN < 0)
    issues.push(err('trolley.trolleyStructuralRatingN', 'Trolley structural rating must be zero (not entered) or positive.'));
  else if (trolley.trolleyStructuralRatingN === 0)
    issues.push(warn('trolley.trolleyStructuralRatingN', 'Trolley structural rating not entered; brake-force check on the trolley is not evaluated.'));

  // ---- crane ----
  if (!finitePositive(crane.ratedCapacityAtRadiusN))
    issues.push(err('crane.ratedCapacityAtRadiusN', 'Crane rated capacity must be a positive number (from crane chart).'));
  if (!finitePositive(crane.hookHeightM))
    issues.push(err('crane.hookHeightM', 'Hook height must be a positive number.'));
  else if (
    finitePositive(site.highPointElevationM) &&
    crane.hookHeightM < site.highPointElevationM
  )
    issues.push(err('crane.hookHeightM', 'Hook height is below the required high-point elevation.'));
  if (!finitePositive(crane.hookRadiusM))
    issues.push(err('crane.hookRadiusM', 'Hook radius must be a positive number.'));
  if (!Number.isFinite(crane.riggingMassKg) || crane.riggingMassKg < 0)
    issues.push(err('crane.riggingMassKg', 'Rigging mass must be zero or positive.'));
  if (!finitePositive(crane.dynamicAmplificationFactor))
    issues.push(err('crane.dynamicAmplificationFactor', 'Dynamic amplification factor must be a positive number.'));
  else if (crane.dynamicAmplificationFactor < 1)
    issues.push(err('crane.dynamicAmplificationFactor', 'Dynamic amplification factor cannot be less than 1.'));

  // ---- anchors ----
  if (!Number.isInteger(anchors.blocksPerAnchor) || anchors.blocksPerAnchor < 1)
    issues.push(err('anchors.blocksPerAnchor', 'Blocks per anchor must be a positive integer.'));
  if (!finitePositive(anchors.blockMassKg))
    issues.push(err('anchors.blockMassKg', 'Block mass must be a positive number.'));
  if (!finitePositive(anchors.groundFrictionCoefficient))
    issues.push(err('anchors.groundFrictionCoefficient', 'Ground friction coefficient must be a positive number.'));
  else if (anchors.groundFrictionCoefficient > 1)
    issues.push(warn('anchors.groundFrictionCoefficient', 'Friction coefficient above 1.0 is unusual; verify ground conditions.'));
  if (!finitePositive(anchors.slidingSafetyFactor))
    issues.push(err('anchors.slidingSafetyFactor', 'Sliding safety factor must be a positive number.'));
  else if (anchors.slidingSafetyFactor < 1.5)
    issues.push(warn('anchors.slidingSafetyFactor', 'Sliding safety factor below 1.5 is below common preliminary practice.'));

  // ---- brake ----
  if (!finitePositive(brake.maxDecelerationMps2))
    issues.push(err('brake.maxDecelerationMps2', 'Maximum deceleration must be a positive number.'));
  if (!finitePositive(brake.availableStrokeM))
    issues.push(err('brake.availableStrokeM', 'Available brake stroke must be a positive number.'));
  if (!Number.isFinite(brake.brakeForceN) || brake.brakeForceN < 0)
    issues.push(err('brake.brakeForceN', 'Brake force must be zero or positive.'));
  else if (
    brake.brakeForceN === 0 &&
    (brake.brakeLaw === 'constant-force' || brake.brakeLaw === 'linear-ramp')
  )
    issues.push(warn('brake.brakeForceN', 'Brake force is zero — the selected brake law produces no braking.'));
  if (!Number.isFinite(brake.velocityCoeffNsPerM) || brake.velocityCoeffNsPerM < 0)
    issues.push(err('brake.velocityCoeffNsPerM', 'Velocity-proportional coefficient must be zero or positive.'));
  else if (brake.velocityCoeffNsPerM === 0 && brake.brakeLaw === 'velocity-proportional')
    issues.push(warn('brake.velocityCoeffNsPerM', 'Velocity coefficient is zero — the selected brake law produces no braking.'));
  if (!Number.isFinite(brake.brakeCapacityN) || brake.brakeCapacityN < 0)
    issues.push(err('brake.brakeCapacityN', 'Brake capacity must be zero (not entered) or positive.'));
  else if (brake.brakeCapacityN === 0)
    issues.push(warn('brake.brakeCapacityN', 'Brake hardware capacity not entered; capacity check is not evaluated.'));

  // ---- environment ----
  if (!Number.isFinite(environment.steadyCrosswindMps) || environment.steadyCrosswindMps < 0)
    issues.push(err('environment.steadyCrosswindMps', 'Crosswind must be zero or positive.'));
  if (!Number.isFinite(environment.gustMps) || environment.gustMps < 0)
    issues.push(err('environment.gustMps', 'Gust speed must be zero or positive.'));
  else if (
    Number.isFinite(environment.steadyCrosswindMps) &&
    environment.gustMps < environment.steadyCrosswindMps
  )
    issues.push(warn('environment.gustMps', 'Gust speed is below the steady crosswind; verify inputs.'));
  if (!Number.isFinite(environment.temperatureC))
    issues.push(err('environment.temperatureC', 'Temperature must be a number.'));
  if (!Number.isFinite(environment.alongTrackWindMps))
    issues.push(err('environment.alongTrackWindMps', 'Along-track wind must be a number (+ = tailwind).'));
  if (!finitePositive(environment.airDensityKgPerM3))
    issues.push(err('environment.airDensityKgPerM3', 'Air density must be a positive number.'));
  else if (environment.airDensityKgPerM3 < 0.9 || environment.airDensityKgPerM3 > 1.4)
    issues.push(warn('environment.airDensityKgPerM3', 'Air density outside 0.9–1.4 kg/m³ is unusual near sea level; verify.'));

  // ---- dynamics settings ----
  const dyn = s.dynamics;
  if (!Number.isFinite(dyn.releasePositionFrac) || dyn.releasePositionFrac < 0 || dyn.releasePositionFrac >= 1)
    issues.push(err('dynamics.releasePositionFrac', 'Release position must be in [0, 1) of the main span.'));
  if (!Number.isFinite(dyn.releaseSpeedMps) || dyn.releaseSpeedMps < 0)
    issues.push(err('dynamics.releaseSpeedMps', 'Release speed must be zero or positive.'));
  if (!finitePositive(dyn.timeStepS))
    issues.push(err('dynamics.timeStepS', 'Simulation time step must be a positive number.'));
  else {
    if (dyn.timeStepS > 0.1)
      issues.push(warn('dynamics.timeStepS', 'Time step above 0.1 s reduces integration accuracy.'));
    if (dyn.timeStepS < 1e-4)
      issues.push(warn('dynamics.timeStepS', 'Time step below 0.0001 s is unnecessarily slow.'));
  }
  if (!finitePositive(dyn.maxSimTimeS))
    issues.push(err('dynamics.maxSimTimeS', 'Simulation time limit must be a positive number.'));

  return {
    issues,
    isValid: !issues.some((i) => i.severity === 'error'),
  };
}
