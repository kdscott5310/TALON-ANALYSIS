import type { Scenario } from './scenario';
import { ftToM, inToM, lbToKg, lbfToN, mphToMps } from '../units/units';

/**
 * UNVERIFIED EXAMPLE SCENARIO.
 * Values mirror the PROJECT_SPEC baseline configuration (Section 17).
 * Every value below is provisional and requires field measurement,
 * manufacturer data, or professional approval before use.
 */
export const exampleScenario: Scenario = {
  schemaVersion: 2,
  name: 'Baseline 200 ft x 1,000 ft (UNVERIFIED EXAMPLE)',
  isUnverifiedExample: true,
  site: {
    horizontalSpanM: ftToM(1000),
    highPointElevationM: ftToM(200),
    brakeAnchorElevationM: 0,
    launchAnchorOffsetM: ftToM(300),
    brakeZoneLengthM: ftToM(50),
    captureZoneLengthM: ftToM(20),
    minGroundClearanceM: ftToM(10),
  },
  cable: {
    materialLabel: 'Generic HMPE (pending manufacturer confirmation)',
    diameterM: inToM(0.5),
    linearMassKgPerM: 0.11, // PROVISIONAL example for 1/2" HMPE class
    minBreakingStrengthN: lbfToN(30000), // PROVISIONAL example value
    designFactor: 5,
    pretensionN: lbfToN(2500),
  },
  trolley: {
    trolleyMassKg: lbToKg(75),
    testArticleMassKg: lbToKg(225),
    payloadDropM: ftToM(5),
    maxAllowableSpeedMps: mphToMps(65),
    rollingResistanceCoeff: 0.015, // PROVISIONAL — sealed-bearing wheels on HMPE, verify by test
    dragAreaM2: 0.4, // PROVISIONAL Cd*A estimate — verify by test or manufacturer data
    trolleyStructuralRatingN: 0, // NOT ENTERED — requires trolley design/proof test
  },
  crane: {
    ratedCapacityAtRadiusN: lbfToN(8600), // user must confirm against crane chart
    hookHeightM: ftToM(200),
    hookRadiusM: ftToM(40),
    riggingMassKg: lbToKg(500),
    dynamicAmplificationFactor: 1.5, // PROVISIONAL
  },
  anchors: {
    blocksPerAnchor: 5,
    blockMassKg: lbToKg(4000), // PROVISIONAL — verify block weight in field
    groundFrictionCoefficient: 0.5, // PROVISIONAL placeholder
    slidingSafetyFactor: 2,
  },
  brake: {
    brakeType: 'hydraulic-sled',
    maxDecelerationMps2: 3 * 9.80665,
    availableStrokeM: ftToM(50),
    brakeLaw: 'constant-force',
    brakeForceN: lbfToN(900), // PROVISIONAL sizing value — requires brake design calc
    velocityCoeffNsPerM: 250, // PROVISIONAL — for velocity-proportional comparison only
    brakeCapacityN: 0, // NOT ENTERED — requires brake hardware rating
  },
  environment: {
    steadyCrosswindMps: mphToMps(10),
    gustMps: mphToMps(20),
    temperatureC: 25,
    alongTrackWindMps: 0, // calm along-track default; set to site forecast
    airDensityKgPerM3: 1.225, // standard sea level
  },
  dynamics: {
    releasePositionFrac: 0,
    releaseSpeedMps: 0,
    timeStepS: 0.01,
    maxSimTimeS: 120,
  },
};
