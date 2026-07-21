/**
 * CUFTS fixture template — Milestone 6.
 *
 * Builds a generalized `Project` from the v1 CUFTS `Scenario`, and extracts the
 * `Scenario` back out so the existing, benchmarked solvers keep running
 * unchanged behind an adapter.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THE SCENARIO IS PRESERVED VERBATIM
 * ═══════════════════════════════════════════════════════════════════════
 * The v1 solvers (parabolic cable, master-node equilibrium, anchor checks,
 * RK4 trolley dynamics) are covered by 16 analytical benchmarks and 115 tests.
 * Re-deriving their inputs from the generalized entities would risk silent
 * numerical drift, so the template stores the `Scenario` as
 * `templateData.cufts` — the authoritative input — and *projects* the
 * generalized topology from it for the platform layer, visualization, and
 * future solvers. `extractScenario` returns that stored scenario, which makes
 * `Scenario → Project → Scenario` exactly lossless and keeps every v1 result
 * bit-identical (release gate 17).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * GEOMETRY MAPPING (matches src/calculations/layoutGeometry.ts)
 * ═══════════════════════════════════════════════════════════════════════
 *   launch anchor  x = 0,                       z = 0
 *   master node    x = launchAnchorOffset,      z = highPointElevation
 *   capture point  x = offset + horizontalSpan, z = brakeAnchorElevation
 *   brake ground   same x as capture,           z = capture − captureHeight
 * All y = 0: the CUFTS template is planar until the M11 lateral model.
 */

import type { Scenario } from '../../models/scenario';
import { GRAVITY } from '../../units/units';
import {
  globalCoordinateSystem,
  GLOBAL_CS_ID,
  vec3,
  type CoordinateSystem,
  type ModelNode,
} from '../coordinates';
import type {
  BrakeForceElement,
  CableElement,
  Element,
  Material,
  PointMassElement,
  SupportElementDef,
} from '../elements';
import {
  exampleValue,
  missing,
  provisional,
  worstState,
  type Quantity,
} from '../provenance';
import type { Dimension } from '../dimensions';
import { PARABOLIC_STATIC_V1, RK4_TROLLEY_V1 } from '../solver';
import {
  PROJECT_SCHEMA_VERSION,
  type AnalysisCase,
  type AssumptionEntry,
  type Constraint,
  type Load,
  type LoadCase,
  type LoadCombination,
  type MovingBody,
  type Project,
  type Support,
  type VerificationMetadata,
} from '../model';
import { getTemplateInfo, registerTemplateBuilder } from './registry';

/** Stable ids so migrated projects are reproducible (Rule 9). */
export const CUFTS_IDS = {
  launchAnchorNode: 'node-launch-anchor',
  masterNode: 'node-master',
  capturePointNode: 'node-capture-point',
  brakeGroundNode: 'node-brake-ground',
  trolleyNode: 'node-trolley',
  backstayElement: 'elem-backstay-cable',
  mainLineElement: 'elem-main-line-cable',
  trolleyMassElement: 'elem-trolley-mass',
  brakeElement: 'elem-brake-force',
  launchAnchorElement: 'elem-launch-anchor-ballast',
  brakeAnchorElement: 'elem-brake-anchor-ballast',
  cableMaterial: 'mat-cable',
  trolleyBody: 'body-trolley',
  gravityLoad: 'load-gravity',
  pretensionLoad: 'load-pretension',
  windLoad: 'load-wind',
  brakeLoad: 'load-brake',
  staticCase: 'lc-static',
  dynamicCase: 'lc-dynamic',
  serviceCombination: 'combo-service',
  staticAnalysis: 'ac-static-sweep',
  dynamicAnalysis: 'ac-dynamic-run',
} as const;

/**
 * Example-scenario values are illustrative placeholders; a user-edited
 * scenario is provisional (entered but unverified). Neither is ever verified —
 * that requires explicit user confirmation against a cited source (Rule 4).
 */
function stateFor(scenario: Scenario) {
  return <D extends Dimension>(v: number, dimension: D, note?: string): Quantity<D> =>
    scenario.isUnverifiedExample
      ? exampleValue(v, dimension, note)
      : provisional(v, dimension, note);
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

  // ── coordinate systems ─────────────────────────────────────────────────
  const coordinateSystems: CoordinateSystem[] = [
    globalCoordinateSystem(),
    {
      id: 'cs-crane',
      name: 'Crane',
      kind: 'crane',
      origin: vec3(masterX, 0, 0),
      rotation: null,
      parentId: GLOBAL_CS_ID,
      description: 'Origin at the crane station on the ground; axes parallel to global.',
    },
    {
      id: 'cs-trolley-path',
      name: 'Trolley path',
      kind: 'trolleyPath',
      origin: vec3(masterX, 0, site.highPointElevationM),
      rotation: null,
      parentId: GLOBAL_CS_ID,
      description: 'Origin at the master node; x measured downrange along the main span.',
    },
  ];

  // ── nodes ──────────────────────────────────────────────────────────────
  const nodes: ModelNode[] = [
    {
      id: CUFTS_IDS.launchAnchorNode,
      name: 'Launch anchor',
      csId: GLOBAL_CS_ID,
      position: vec3(0, 0, 0),
      role: 'anchor',
    },
    {
      id: CUFTS_IDS.masterNode,
      name: 'Master ring / crane hook',
      csId: GLOBAL_CS_ID,
      position: vec3(masterX, 0, site.highPointElevationM),
      role: 'masterRing',
    },
    {
      id: CUFTS_IDS.capturePointNode,
      name: 'Capture point / cable terminus',
      csId: GLOBAL_CS_ID,
      position: vec3(captureX, 0, site.brakeAnchorElevationM),
      role: 'brakeAttachment',
    },
    {
      id: CUFTS_IDS.brakeGroundNode,
      name: 'Brake-end ground',
      csId: GLOBAL_CS_ID,
      position: vec3(captureX, 0, brakeGroundZ),
      role: 'groundContact',
    },
    {
      id: CUFTS_IDS.trolleyNode,
      name: 'Trolley',
      csId: GLOBAL_CS_ID,
      position: vec3(
        masterX + scenario.dynamics.releasePositionFrac * site.horizontalSpanM,
        0,
        site.highPointElevationM,
      ),
      role: 'trolley',
    },
  ];

  // ── materials ──────────────────────────────────────────────────────────
  const materials: Material[] = [
    {
      id: CUFTS_IDS.cableMaterial,
      name: scenario.cable.materialLabel,
      category: 'cable material',
      elasticModulus: missing(
        'pressure',
        'Not supplied by the v1 CUFTS scenario; required by the M8 nonlinear cable solver.',
      ),
      density: missing('density', 'Linear mass is supplied instead; bulk density unknown.'),
      thermalExpansion: missing('thermalExpansion', 'Required for M8 temperature strain.'),
      notes: 'Cable material properties require manufacturer verification.',
    },
  ];

  // ── cable elements ─────────────────────────────────────────────────────
  const cableCommon = {
    linearMass: q(scenario.cable.linearMassKgPerM, 'linearDensity'),
    diameter: q(scenario.cable.diameterM, 'length'),
    minBreakingStrength: q(
      scenario.cable.minBreakingStrengthN,
      'force',
      'Requires manufacturer certificate.',
    ),
    designFactor: q(scenario.cable.designFactor, 'dimensionless'),
    pretension: q(scenario.cable.pretensionN, 'force'),
    // Absent from the v1 scenario — genuinely missing, never defaulted (Rule 3).
    axialStiffness: missing(
      'force',
      'EA not supplied by the v1 scenario; required by the M8 nonlinear cable solver.',
    ),
    unstretchedLength: missing(
      'length',
      'Not supplied by the v1 scenario; M8 solves compatibility from it.',
    ),
    creepAllowance: missing('dimensionless', 'Constructional stretch allowance not supplied.'),
    dampingRatio: missing('dimensionless', 'Cable damping not supplied; required by M11.'),
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

  // ── trolley mass and brake ─────────────────────────────────────────────
  const totalMovingMass = scenario.trolley.trolleyMassKg + scenario.trolley.testArticleMassKg;

  const trolleyMass: PointMassElement = {
    id: CUFTS_IDS.trolleyMassElement,
    name: 'Trolley + test article',
    type: 'pointMass',
    nodeIds: [CUFTS_IDS.trolleyNode],
    mass: q(totalMovingMass, 'mass'),
    rotaryInertia: missing('rotaryInertia', 'Wheel rotary inertia not supplied; required by M9.'),
  };

  const brake: BrakeForceElement = {
    id: CUFTS_IDS.brakeElement,
    name: `Ground brake (${scenario.brake.brakeType})`,
    type: 'brakeForce',
    nodeIds: [CUFTS_IDS.trolleyNode, CUFTS_IDS.capturePointNode],
    lawId: scenario.brake.brakeLaw,
    parameters: {
      brakeForce: q(scenario.brake.brakeForceN, 'force'),
      velocityCoefficient: q(scenario.brake.velocityCoeffNsPerM, 'dampingCoefficient'),
      maxDeceleration: q(scenario.brake.maxDecelerationMps2, 'acceleration'),
    },
    engagementPosition: q(site.horizontalSpanM - site.brakeZoneLengthM, 'length'),
    availableStroke: q(scenario.brake.availableStrokeM, 'length'),
    // A capacity of 0 in v1 means "not entered" — preserved as MISSING (Rule 3).
    forceCapacity:
      scenario.brake.brakeCapacityN > 0
        ? q(scenario.brake.brakeCapacityN, 'force')
        : missing('force', 'Brake hardware capacity not entered; capacity check not evaluated.'),
    energyCapacity: missing('energy', 'Brake energy capacity not supplied; required by M10.'),
  };

  // ── ballast anchors as support elements ────────────────────────────────
  const anchorWeightN = scenario.anchors.blocksPerAnchor * scenario.anchors.blockMassKg * GRAVITY;

  const launchAnchorBallast: SupportElementDef = {
    id: CUFTS_IDS.launchAnchorElement,
    name: 'Launch-anchor ballast cluster',
    type: 'supportElement',
    nodeIds: [CUFTS_IDS.launchAnchorNode],
    deadWeight: q(anchorWeightN, 'force', 'Block weight requires field verification.'),
    frictionCoefficient: q(
      scenario.anchors.groundFrictionCoefficient,
      'dimensionless',
      'Requires geotechnical assessment or field test.',
    ),
    lateralCapacity: missing('force', 'Rated lateral capacity not supplied; friction is used instead.'),
    upliftCapacity: missing('force', 'No soil or helical anchors credited; dead weight only.'),
  };

  const brakeAnchorBallast: SupportElementDef = {
    ...launchAnchorBallast,
    id: CUFTS_IDS.brakeAnchorElement,
    name: 'Brake-anchor ballast cluster',
    nodeIds: [CUFTS_IDS.capturePointNode],
  };

  const elements: Element[] = [
    backstay,
    mainLine,
    trolleyMass,
    brake,
    launchAnchorBallast,
    brakeAnchorBallast,
  ];

  // ── supports ───────────────────────────────────────────────────────────
  const supports: Support[] = [
    {
      id: 'sup-launch-anchor',
      name: 'Launch anchor',
      nodeId: CUFTS_IDS.launchAnchorNode,
      kind: 'fixed',
      restrained: { x: true, y: true, z: true },
      csId: GLOBAL_CS_ID,
      notes: 'Ballast-block anchor; sliding/uplift capacity checked by the anchor solver.',
    },
    {
      id: 'sup-capture-point',
      name: 'Brake anchor',
      nodeId: CUFTS_IDS.capturePointNode,
      kind: 'fixed',
      restrained: { x: true, y: true, z: true },
      csId: GLOBAL_CS_ID,
      notes: 'Ballast-block anchor at the capture terminus.',
    },
    {
      id: 'sup-master-node',
      name: 'Crane hook',
      nodeId: CUFTS_IDS.masterNode,
      kind: 'prescribed',
      restrained: { x: false, y: false, z: true },
      csId: GLOBAL_CS_ID,
      prescribedDisplacement: {
        z: q(scenario.crane.hookHeightM, 'length', 'Crane hook height; support motion modeled in M11.'),
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
      pathParameter: q(scenario.dynamics.releasePositionFrac, 'dimensionless'),
    },
  ];

  // ── loads, load cases, combinations ────────────────────────────────────
  const loads: Load[] = [
    {
      id: CUFTS_IDS.gravityLoad,
      name: 'Gravity',
      kind: 'gravity',
      csId: GLOBAL_CS_ID,
      components: { z: provisional(-GRAVITY, 'acceleration', 'Standard gravity.') },
    },
    {
      id: CUFTS_IDS.pretensionLoad,
      name: 'Cable pretension',
      kind: 'pretension',
      elementId: CUFTS_IDS.mainLineElement,
      magnitude: q(scenario.cable.pretensionN, 'force'),
    },
    {
      id: CUFTS_IDS.windLoad,
      name: 'Wind',
      kind: 'wind',
      csId: GLOBAL_CS_ID,
      components: {
        x: q(scenario.environment.alongTrackWindMps, 'velocity', 'Along-track (+ tailwind).'),
        y: q(scenario.environment.steadyCrosswindMps, 'velocity', 'Steady crosswind.'),
      },
      magnitude: q(scenario.environment.gustMps, 'velocity', 'Gust speed.'),
    },
    {
      id: CUFTS_IDS.brakeLoad,
      name: 'Brake force',
      kind: 'brakeForce',
      elementId: CUFTS_IDS.brakeElement,
      magnitude: q(scenario.brake.brakeForceN, 'force'),
    },
  ];

  const loadCases: LoadCase[] = [
    {
      id: CUFTS_IDS.staticCase,
      name: 'Static — self weight + pretension + trolley',
      kind: 'trolleyAtPosition',
      description: 'Static equilibrium with the trolley swept along the main span.',
      factors: [
        { loadId: CUFTS_IDS.gravityLoad, factor: 1 },
        { loadId: CUFTS_IDS.pretensionLoad, factor: 1 },
      ],
    },
    {
      id: CUFTS_IDS.dynamicCase,
      name: 'Dynamic run — gravity, drag, wind, braking',
      kind: 'normalOperation',
      description: 'Time-domain descent from release through brake engagement.',
      factors: [
        { loadId: CUFTS_IDS.gravityLoad, factor: 1 },
        { loadId: CUFTS_IDS.pretensionLoad, factor: 1 },
        { loadId: CUFTS_IDS.windLoad, factor: 1 },
        { loadId: CUFTS_IDS.brakeLoad, factor: 1 },
      ],
    },
  ];

  /** Unfactored service combination — no code combination is assumed (Rule: M12). */
  const loadCombinations: LoadCombination[] = [
    {
      id: CUFTS_IDS.serviceCombination,
      name: 'Service (unfactored)',
      terms: [
        { loadCaseId: CUFTS_IDS.staticCase, factor: 1 },
        { loadCaseId: CUFTS_IDS.dynamicCase, factor: 1 },
      ],
      notes:
        'Unfactored service combination. No building-code combination is applied unless the ' +
        'user explicitly selects a standard and revision.',
    },
  ];

  // ── moving body ────────────────────────────────────────────────────────
  const movingBodies: MovingBody[] = [
    {
      id: CUFTS_IDS.trolleyBody,
      name: 'Instrumented trolley',
      pathElementId: CUFTS_IDS.mainLineElement,
      mass: q(totalMovingMass, 'mass'),
      wheelRotaryInertia: missing(
        'rotaryInertia',
        'Not supplied; the M9 effective-mass formulation requires it.',
      ),
      wheelRadius: missing('length', 'Not supplied by the v1 scenario.'),
      wheelCount: missing('dimensionless', 'Not supplied by the v1 scenario.'),
      rollingResistance: q(
        scenario.trolley.rollingResistanceCoeff,
        'dimensionless',
        'Requires rolldown or field test.',
      ),
      bearingResistance: missing('dimensionless', 'Bearing drag not separated in the v1 model.'),
      dragArea: q(scenario.trolley.dragAreaM2, 'area', 'Requires wind-tunnel or field test.'),
      payloadMass: q(scenario.trolley.testArticleMassKg, 'mass'),
      payloadDrop: q(scenario.trolley.payloadDropM, 'length'),
      payloadDamping: missing('dimensionless', 'Payload pendulum damping not supplied; M9.'),
      structuralRating:
        scenario.trolley.trolleyStructuralRatingN > 0
          ? q(scenario.trolley.trolleyStructuralRatingN, 'force')
          : missing('force', 'Trolley structural rating not entered; check not evaluated.'),
      maxSpeed: q(scenario.trolley.maxAllowableSpeedMps, 'velocity'),
    },
  ];

  // ── analysis cases ─────────────────────────────────────────────────────
  const analysisCases: AnalysisCase[] = [
    {
      id: CUFTS_IDS.staticAnalysis,
      name: 'Static sweep (parabolic)',
      kind: 'staticSweep',
      solverId: PARABOLIC_STATIC_V1.id,
      solverVersion: PARABOLIC_STATIC_V1.version,
      fidelity: PARABOLIC_STATIC_V1.fidelity,
      loadCaseId: CUFTS_IDS.staticCase,
      movingBodyId: CUFTS_IDS.trolleyBody,
      settings: { sweepPositions: 21 },
      notes: 'Runs the v1 parabolic static solvers through the CUFTS adapter.',
    },
    {
      id: CUFTS_IDS.dynamicAnalysis,
      name: 'Dynamic run (RK4)',
      kind: 'dynamicRun',
      solverId: RK4_TROLLEY_V1.id,
      solverVersion: RK4_TROLLEY_V1.version,
      fidelity: RK4_TROLLEY_V1.fidelity,
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

  // ── assumptions carried from the v1 solvers ────────────────────────────
  const assumptions: AssumptionEntry[] = [
    {
      id: 'asm-parabolic',
      statement:
        'Cable statics use the parabolic approximation with horizontal tension fixed at the ' +
        'unloaded pretension; elastic elongation is neglected.',
      state: 'provisional',
      resolutionPath: 'Select the M8 elastic-catenary or segmented nonlinear solver.',
    },
    {
      id: 'asm-point-mass',
      statement:
        'The trolley is a point mass; wheel rotary inertia and payload pendulum motion are ' +
        'not modeled.',
      state: 'provisional',
      resolutionPath: 'Supply wheel inertia and payload damping, then run the M9 solver.',
    },
    {
      id: 'asm-brake-idealized',
      statement: 'Brake response follows an idealized law rather than a measured hardware curve.',
      state: 'provisional',
      resolutionPath: 'Import a measured force curve in M10.',
    },
    {
      id: 'asm-planar',
      statement:
        'The model is planar: lateral cable motion and out-of-plane loading are not modeled.',
      state: 'provisional',
      resolutionPath: 'Run the M11 lateral/out-of-plane dynamics model.',
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
    launchAnchorBallast.deadWeight!,
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
    reviewStatus: 'draft',
    engineerReviewed: false,
  };

  const templateInfo = getTemplateInfo('cufts')!;

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: options.id ?? 'project-cufts',
    name: scenario.name,
    description:
      'Captive UAS Final-Approach Test System (CUFTS) — crane-supported cable, ' +
      'instrumented downhill trolley, progressive ground braking.',
    createdOn: options.createdOn ?? new Date().toISOString(),
    revision: options.revision ?? '1',
    identity: {
      testProgram: 'CUFTS',
      notes: 'Identity fields are user-supplied; none are inferred by the software.',
    },
    template: {
      id: 'cufts',
      name: templateInfo.name,
      description: templateInfo.description,
      dataVersion: scenario.schemaVersion,
    },
    templateData: { cufts: scenario },
    coordinateSystems,
    nodes,
    materials,
    components: [],
    elements,
    supports,
    constraints,
    loads,
    loadCases,
    loadCombinations,
    movingBodies,
    analysisCases,
    analysisRuns: [],
    risks: [],
    assumptions,
    testData: [],
    reports: [],
    bom: [],
    revisions: [
      {
        revision: options.revision ?? '1',
        changedOn: options.createdOn ?? new Date().toISOString(),
        summary: 'Project created from the CUFTS fixture template.',
      },
    ],
    verification,
  };
}

/**
 * Adapter: recovers the CUFTS `Scenario` the v1 solvers consume.
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

// Register CUFTS as the first implemented fixture template.
registerTemplateBuilder('cufts', buildCuftsProject);
