/**
 * CUFTS project template — Milestone 6.
 *
 * Builds a generalized `Project` from the v1 CUFTS `Scenario`, and extracts
 * the `Scenario` back out again so the existing, benchmarked solvers keep
 * running unchanged behind an adapter.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THE SCENARIO IS PRESERVED VERBATIM
 * ═══════════════════════════════════════════════════════════════════════
 * The v1 solvers (parabolic cable, master-node equilibrium, anchor checks,
 * RK4 trolley dynamics) are validated by 115 tests and 16 analytical
 * benchmarks. Re-deriving their inputs from the generalized entities would
 * risk silent numerical drift. So the template stores the `Scenario` as
 * `templateData.cufts` — the authoritative input — and *projects* the
 * generalized topology (nodes, elements, supports, loads, moving body) from
 * it for the platform layer, visualization, and future solvers.
 *
 * The projection is therefore derived data. `extractScenario` returns the
 * stored scenario, which makes `Scenario → Project → Scenario` exactly
 * lossless and keeps every v1 result bit-identical.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * GEOMETRY MAPPING (matches src/calculations/layoutGeometry.ts)
 * ═══════════════════════════════════════════════════════════════════════
 *   launch anchor  x = 0,                       z = 0
 *   master node    x = launchAnchorOffset,      z = highPointElevation
 *   capture point  x = offset + horizontalSpan, z = brakeAnchorElevation
 *   brake ground   same x as capture,           z = capture − captureHeight
 * All y = 0: the CUFTS template is planar until the M8 lateral model.
 */

import type { Scenario } from '../../models/scenario';
import { GRAVITY } from '../../units/units';
import {
  globalCoordinateSystem,
  GLOBAL_CS_ID,
  vec3,
  type ModelNode,
} from '../geometry';
import type {
  BrakeContactElement,
  CableElement,
  Element,
  Material,
  PointMassElement,
} from '../elements';
import {
  exampleValue,
  missing,
  provisional,
  worstState,
  type Quantity,
} from '../provenance';
import {
  PROJECT_SCHEMA_VERSION,
  type AnalysisCase,
  type Constraint,
  type Load,
  type LoadCase,
  type MovingBody,
  type Project,
  type Support,
  type VerificationMetadata,
} from '../model';

// Stable ids so migrated projects are reproducible (Rule 8).
export const CUFTS_IDS = {
  launchAnchorNode: 'node-launch-anchor',
  masterNode: 'node-master',
  capturePointNode: 'node-capture-point',
  brakeGroundNode: 'node-brake-ground',
  trolleyNode: 'node-trolley',
  backstayElement: 'elem-backstay-cable',
  mainLineElement: 'elem-main-line-cable',
  trolleyMassElement: 'elem-trolley-mass',
  brakeElement: 'elem-brake-contact',
  cableMaterial: 'mat-cable',
  trolleyBody: 'body-trolley',
  gravityLoad: 'load-gravity',
  pretensionLoad: 'load-pretension',
  windLoad: 'load-wind',
  brakeLoad: 'load-brake',
  staticCase: 'lc-static',
  dynamicCase: 'lc-dynamic',
  staticAnalysis: 'ac-static-sweep',
  dynamicAnalysis: 'ac-dynamic-run',
} as const;

/**
 * Example-scenario values are illustrative placeholders; a user-edited
 * scenario is treated as provisional (entered but unverified). Neither is
 * ever `verified` — that requires explicit user confirmation with a source.
 */
function stateFor(scenario: Scenario) {
  return scenario.isUnverifiedExample
    ? (v: number, unit: Parameters<typeof exampleValue>[1], note?: string): Quantity =>
        exampleValue(v, unit, note)
    : (v: number, unit: Parameters<typeof provisional>[1], note?: string): Quantity =>
        provisional(v, unit, note);
}

/** Builds the generalized project representation of a CUFTS scenario. */
export function buildCuftsProject(
  scenario: Scenario,
  options: { id?: string; createdOn?: string; revision?: string } = {},
): Project {
  const q = stateFor(scenario);
  const site = scenario.site;

  const masterX = site.launchAnchorOffsetM;
  const captureX = site.launchAnchorOffsetM + site.horizontalSpanM;
  const brakeGroundZ = site.brakeAnchorElevationM - site.captureHeightAboveGroundM;

  // ── nodes ──────────────────────────────────────────────────────────────
  const nodes: ModelNode[] = [
    {
      id: CUFTS_IDS.launchAnchorNode,
      name: 'Launch anchor',
      csId: GLOBAL_CS_ID,
      position: vec3(0, 0, 0),
    },
    {
      id: CUFTS_IDS.masterNode,
      name: 'Master node (crane hook)',
      csId: GLOBAL_CS_ID,
      position: vec3(masterX, 0, site.highPointElevationM),
    },
    {
      id: CUFTS_IDS.capturePointNode,
      name: 'Capture point / cable terminus',
      csId: GLOBAL_CS_ID,
      position: vec3(captureX, 0, site.brakeAnchorElevationM),
    },
    {
      id: CUFTS_IDS.brakeGroundNode,
      name: 'Brake-end ground',
      csId: GLOBAL_CS_ID,
      position: vec3(captureX, 0, brakeGroundZ),
    },
    {
      id: CUFTS_IDS.trolleyNode,
      name: 'Trolley',
      csId: GLOBAL_CS_ID,
      // Initial position: release station on the main line.
      position: vec3(
        masterX + scenario.dynamics.releasePositionFrac * site.horizontalSpanM,
        0,
        site.highPointElevationM,
      ),
    },
  ];

  // ── materials ──────────────────────────────────────────────────────────
  const materials: Material[] = [
    {
      id: CUFTS_IDS.cableMaterial,
      name: scenario.cable.materialLabel,
      category: 'cable material',
      // EA / modulus are not part of the v1 Scenario: genuinely missing, not 0.
      elasticModulus: missing('Pa', 'Not supplied by the v1 CUFTS scenario; required by the M7 nonlinear solver.'),
      density: missing('kg/m^3', 'Linear mass is supplied instead; bulk density unknown.'),
      thermalExpansion: missing('1/K', 'Required for M7 temperature strain.'),
      notes: 'Cable material properties require manufacturer verification.',
    },
  ];

  // ── cable elements ─────────────────────────────────────────────────────
  const cableCommon = {
    linearMass: q(scenario.cable.linearMassKgPerM, 'kg/m'),
    diameter: q(scenario.cable.diameterM, 'm'),
    minBreakingStrength: q(scenario.cable.minBreakingStrengthN, 'N', 'Requires manufacturer certificate.'),
    designFactor: q(scenario.cable.designFactor, '1'),
    pretension: q(scenario.cable.pretensionN, 'N'),
    // Not in the v1 scenario — missing, never defaulted (Rule 2).
    axialStiffness: missing('N', 'EA not supplied by the v1 scenario; required by the M7 nonlinear cable solver.'),
    unstretchedLength: missing('m', 'Not supplied by the v1 scenario; M7 solves compatibility from it.'),
    creepAllowance: missing('1', 'Constructional stretch allowance not supplied.'),
    dampingRatio: missing('1', 'Cable damping not supplied; required by M8.'),
    materialId: CUFTS_IDS.cableMaterial,
  };

  const backstay: CableElement = {
    id: CUFTS_IDS.backstayElement,
    name: 'Launch-side backstay',
    type: 'cable',
    nodeIds: [CUFTS_IDS.launchAnchorNode, CUFTS_IDS.masterNode],
    ...cableCommon,
  };

  const mainLine: CableElement = {
    id: CUFTS_IDS.mainLineElement,
    name: 'Main downhill test line',
    type: 'cable',
    nodeIds: [CUFTS_IDS.masterNode, CUFTS_IDS.capturePointNode],
    ...cableCommon,
  };

  // ── trolley mass and brake elements ────────────────────────────────────
  const totalMovingMass = scenario.trolley.trolleyMassKg + scenario.trolley.testArticleMassKg;

  const trolleyMass: PointMassElement = {
    id: CUFTS_IDS.trolleyMassElement,
    name: 'Trolley + test article',
    type: 'pointMass',
    nodeIds: [CUFTS_IDS.trolleyNode],
    mass: q(totalMovingMass, 'kg'),
    rotaryInertia: missing('kg*m^2', 'Wheel rotary inertia not supplied; required by M8.'),
  };

  const brake: BrakeContactElement = {
    id: CUFTS_IDS.brakeElement,
    name: `Ground brake (${scenario.brake.brakeType})`,
    type: 'brakeContact',
    nodeIds: [CUFTS_IDS.trolleyNode, CUFTS_IDS.capturePointNode],
    lawId: scenario.brake.brakeLaw,
    parameters: {
      brakeForce: q(scenario.brake.brakeForceN, 'N'),
      velocityCoefficient: q(scenario.brake.velocityCoeffNsPerM, 'N*s/m'),
      maxDeceleration: q(scenario.brake.maxDecelerationMps2, 'm/s^2'),
    },
    engagementPosition: q(site.horizontalSpanM - site.brakeZoneLengthM, 'm'),
    availableStroke: q(scenario.brake.availableStrokeM, 'm'),
    // A capacity of 0 in v1 means "not entered" — preserve that as MISSING.
    forceCapacity:
      scenario.brake.brakeCapacityN > 0
        ? q(scenario.brake.brakeCapacityN, 'N')
        : missing('N', 'Brake hardware capacity not entered; capacity check not evaluated.'),
  };

  const elements: Element[] = [backstay, mainLine, trolleyMass, brake];

  // ── supports ───────────────────────────────────────────────────────────
  const supports: Support[] = [
    {
      id: 'sup-launch-anchor',
      name: 'Launch anchor (ballast)',
      nodeId: CUFTS_IDS.launchAnchorNode,
      kind: 'fixed',
      restrained: { x: true, y: true, z: true },
      notes: 'Ballast-block anchor; sliding/uplift capacity checked by the anchor solver.',
    },
    {
      id: 'sup-capture-point',
      name: 'Brake anchor (ballast)',
      nodeId: CUFTS_IDS.capturePointNode,
      kind: 'fixed',
      restrained: { x: true, y: true, z: true },
      notes: 'Ballast-block anchor at the capture terminus.',
    },
    {
      id: 'sup-master-node',
      name: 'Crane hook',
      nodeId: CUFTS_IDS.masterNode,
      kind: 'prescribed',
      restrained: { x: false, y: false, z: true },
      prescribedDisplacement: {
        z: q(scenario.crane.hookHeightM, 'm', 'Crane hook height; support motion modeled in M8.'),
      },
      notes: 'Crane-supported master node; hook load compared against user-entered capacity.',
    },
  ];

  // ── constraint: trolley rides the main line ────────────────────────────
  const constraints: Constraint[] = [
    {
      id: 'con-trolley-on-line',
      name: 'Trolley travels along the main line',
      kind: 'nodeOnPath',
      nodeIds: [CUFTS_IDS.trolleyNode],
      pathElementId: CUFTS_IDS.mainLineElement,
      pathParameter: q(scenario.dynamics.releasePositionFrac, '1'),
    },
  ];

  // ── loads and load cases ───────────────────────────────────────────────
  const loads: Load[] = [
    {
      id: CUFTS_IDS.gravityLoad,
      name: 'Gravity',
      kind: 'gravity',
      components: { z: provisional(-GRAVITY, 'm/s^2', 'Standard gravity.') },
    },
    {
      id: CUFTS_IDS.pretensionLoad,
      name: 'Cable pretension',
      kind: 'pretension',
      elementId: CUFTS_IDS.mainLineElement,
      magnitude: q(scenario.cable.pretensionN, 'N'),
    },
    {
      id: CUFTS_IDS.windLoad,
      name: 'Wind',
      kind: 'wind',
      components: {
        x: q(scenario.environment.alongTrackWindMps, 'm/s', 'Along-track component (+ tailwind).'),
        y: q(scenario.environment.steadyCrosswindMps, 'm/s', 'Steady crosswind.'),
      },
      magnitude: q(scenario.environment.gustMps, 'm/s', 'Gust speed.'),
    },
    {
      id: CUFTS_IDS.brakeLoad,
      name: 'Brake force',
      kind: 'brakeForce',
      elementId: CUFTS_IDS.brakeElement,
      magnitude: q(scenario.brake.brakeForceN, 'N'),
    },
  ];

  const loadCases: LoadCase[] = [
    {
      id: CUFTS_IDS.staticCase,
      name: 'Static — self weight + pretension + trolley',
      description: 'Static equilibrium with the trolley swept along the main span.',
      factors: [
        { loadId: CUFTS_IDS.gravityLoad, factor: 1 },
        { loadId: CUFTS_IDS.pretensionLoad, factor: 1 },
      ],
    },
    {
      id: CUFTS_IDS.dynamicCase,
      name: 'Dynamic run — gravity, drag, wind, braking',
      description: 'Time-domain descent from release through brake engagement.',
      factors: [
        { loadId: CUFTS_IDS.gravityLoad, factor: 1 },
        { loadId: CUFTS_IDS.pretensionLoad, factor: 1 },
        { loadId: CUFTS_IDS.windLoad, factor: 1 },
        { loadId: CUFTS_IDS.brakeLoad, factor: 1 },
      ],
    },
  ];

  // ── moving body ────────────────────────────────────────────────────────
  const movingBodies: MovingBody[] = [
    {
      id: CUFTS_IDS.trolleyBody,
      name: 'Instrumented trolley',
      pathElementId: CUFTS_IDS.mainLineElement,
      mass: q(totalMovingMass, 'kg'),
      wheelRotaryInertia: missing('kg*m^2', 'Not supplied; M8 effective-mass formulation requires it.'),
      wheelRadius: missing('m', 'Not supplied by the v1 scenario.'),
      rollingResistance: q(scenario.trolley.rollingResistanceCoeff, '1', 'Requires rolldown or field test.'),
      dragArea: q(scenario.trolley.dragAreaM2, 'm^2', 'Requires wind-tunnel or field test.'),
      payloadMass: q(scenario.trolley.testArticleMassKg, 'kg'),
      payloadDrop: q(scenario.trolley.payloadDropM, 'm'),
      payloadDamping: missing('1', 'Payload pendulum damping not supplied; required by M8.'),
      structuralRating:
        scenario.trolley.trolleyStructuralRatingN > 0
          ? q(scenario.trolley.trolleyStructuralRatingN, 'N')
          : missing('N', 'Trolley structural rating not entered; check not evaluated.'),
    },
  ];

  // ── analysis cases ─────────────────────────────────────────────────────
  const analysisCases: AnalysisCase[] = [
    {
      id: CUFTS_IDS.staticAnalysis,
      name: 'Static sweep (parabolic)',
      kind: 'staticSweep',
      solverId: 'parabolic-v1',
      loadCaseId: CUFTS_IDS.staticCase,
      movingBodyId: CUFTS_IDS.trolleyBody,
      settings: { sweepPositions: 21 },
      notes: 'Runs the v1 parabolic static solvers through the CUFTS adapter.',
    },
    {
      id: CUFTS_IDS.dynamicAnalysis,
      name: 'Dynamic run (RK4)',
      kind: 'dynamicRun',
      solverId: 'rk4-trolley-v1',
      loadCaseId: CUFTS_IDS.dynamicCase,
      movingBodyId: CUFTS_IDS.trolleyBody,
      settings: {
        timeStepS: scenario.dynamics.timeStepS,
        maxSimTimeS: scenario.dynamics.maxSimTimeS,
        releasePositionFrac: scenario.dynamics.releasePositionFrac,
        releaseSpeedMps: scenario.dynamics.releaseSpeedMps,
      },
      notes: 'Runs the v1 RK4 trolley dynamics through the CUFTS adapter.',
    },
  ];

  // ── verification metadata ──────────────────────────────────────────────
  const trackedQuantities: Quantity[] = [
    cableCommon.minBreakingStrength,
    cableCommon.linearMass,
    cableCommon.axialStiffness,
    brake.forceCapacity!,
    movingBodies[0].structuralRating!,
    movingBodies[0].rollingResistance!,
    movingBodies[0].dragArea!,
  ];

  const outstanding: string[] = [
    'Cable MBS, linear mass, and EA require manufacturer verification.',
    'Ecology-block weight and ground friction require field verification.',
    'Crane capacity at radius requires the crane-company load chart.',
  ];
  if (brake.forceCapacity && brake.forceCapacity.value === null) {
    outstanding.push('Brake hardware capacity not entered — capacity check not evaluated.');
  }
  if (movingBodies[0].structuralRating && movingBodies[0].structuralRating.value === null) {
    outstanding.push('Trolley structural rating not entered — trolley load check not evaluated.');
  }

  const verification: VerificationMetadata = {
    overallState: worstState(trackedQuantities),
    outstanding,
    engineerReviewed: false,
  };

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: options.id ?? 'project-cufts',
    name: scenario.name,
    description:
      'Captive UAS Final-Approach Test System (CUFTS) — crane-supported cable, ' +
      'instrumented downhill trolley, progressive ground braking.',
    createdOn: options.createdOn ?? new Date().toISOString(),
    revision: options.revision ?? '1',
    template: {
      id: 'cufts',
      name: 'CUFTS — Captive UAS Final-Approach Test System',
      description:
        'Built-in template preserving the v1 TALON configuration: two-leg cable ' +
        'system on a crane-supported master node with a braked downhill trolley.',
      dataVersion: scenario.schemaVersion,
    },
    templateData: { cufts: scenario },
    coordinateSystems: [globalCoordinateSystem()],
    nodes,
    materials,
    components: [],
    elements,
    supports,
    constraints,
    loads,
    loadCases,
    movingBodies,
    analysisCases,
    results: [],
    verification,
  };
}

/**
 * Adapter: recovers the CUFTS `Scenario` that the v1 solvers consume.
 *
 * Returns the scenario stored by the template, so results are bit-identical
 * to running the solver on the original scenario object.
 */
export function extractScenario(project: Project): Scenario {
  const scenario = project.templateData.cufts;
  if (!scenario) {
    throw new Error(
      `Project "${project.id}" does not carry CUFTS template data; ` +
        'the v1 CUFTS solvers cannot be applied to it.',
    );
  }
  return scenario;
}

/** True when the project can be analyzed by the v1 CUFTS solver adapter. */
export function isCuftsProject(project: Project): boolean {
  return project.template.id === 'cufts' && project.templateData.cufts !== undefined;
}
