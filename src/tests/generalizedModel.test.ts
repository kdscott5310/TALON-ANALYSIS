/**
 * Milestone 6 — generalized model architecture.
 *
 * The headline guarantee: migrating a v1 CUFTS scenario into the generalized
 * project model produces IDENTICAL engineering results. These tests assert
 * exact equality (not tolerance) on static, dynamic, and summary outputs,
 * because the adapter must not perturb the validated v1 numerics.
 */
import { describe, it, expect } from 'vitest';
import { exampleScenario } from '../models/exampleScenario';
import { exportScenarioJson } from '../models/scenarioSerialization';
import type { Scenario } from '../models/scenario';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { runDynamicsAnalysis } from '../calculations/dynamicsAnalysis';
import { summarizeScenario } from '../calculations/statusSummary';
import {
  buildCuftsProject,
  extractScenario,
  isCuftsProject,
  CUFTS_IDS,
} from '../core/templates/cufts';
import {
  analyzeProjectStatic,
  analyzeProjectDynamics,
  summarizeProject,
} from '../core/projectAnalysis';
import {
  exportProjectJson,
  importProjectJson,
  projectFromScenario,
} from '../core/projectSerialization';
import { checkProjectIntegrity, PROJECT_SCHEMA_VERSION } from '../core/model';
import { isCable, isPointMass, isBrakeContact } from '../core/elements';
import { globalPosition } from '../core/geometry';
import { isMissing, requireValue, worstState, valueOrNull } from '../core/provenance';
import { ftToM, lbfToN } from '../units/units';

function clone(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

/** A user-edited (non-example) scenario, to exercise the provisional path. */
function userScenario(): Scenario {
  const s = clone(exampleScenario);
  s.isUnverifiedExample = false;
  s.name = 'Site 4 configuration';
  s.site.brakeAnchorElevationM = ftToM(6);
  s.site.captureHeightAboveGroundM = ftToM(6);
  s.brake.brakeCapacityN = lbfToN(10000);
  s.trolley.trolleyStructuralRatingN = lbfToN(10000);
  return s;
}

describe('results are unchanged after migration to the generalized model', () => {
  const scenarios: [string, Scenario][] = [
    ['baseline example', exampleScenario],
    ['user-edited scenario', userScenario()],
  ];

  for (const [label, scenario] of scenarios) {
    it(`static analysis is identical for the ${label}`, () => {
      const project = buildCuftsProject(scenario);
      for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
        const direct = runStaticAnalysis({ scenario, trolleyPositionFrac: frac });
        const viaProject = analyzeProjectStatic(project, frac);
        expect(viaProject.mainLegLoaded.maxTensionN).toBe(direct.mainLegLoaded.maxTensionN);
        expect(viaProject.masterNode.hookResultantN).toBe(direct.masterNode.hookResultantN);
        expect(viaProject.masterNode.craneUtilization).toBe(direct.masterNode.craneUtilization);
        expect(viaProject.launchAnchor.slidingSF).toBe(direct.launchAnchor.slidingSF);
        expect(viaProject.brakeAnchor.slidingSF).toBe(direct.brakeAnchor.slidingSF);
        expect(viaProject.groundClearanceMarginM).toBe(direct.groundClearanceMarginM);
        expect(viaProject.allWarnings).toEqual(direct.allWarnings);
      }
    });

    it(`dynamic analysis is identical for the ${label}`, () => {
      const project = buildCuftsProject(scenario);
      const direct = runDynamicsAnalysis(scenario);
      const viaProject = analyzeProjectDynamics(project);
      expect(viaProject.sim.finalSM).toBe(direct.sim.finalSM);
      expect(viaProject.sim.finalTimeS).toBe(direct.sim.finalTimeS);
      expect(viaProject.sim.peakSpeedMps).toBe(direct.sim.peakSpeedMps);
      expect(viaProject.sim.peakDecelMps2).toBe(direct.sim.peakDecelMps2);
      expect(viaProject.sim.peakBrakeForceN).toBe(direct.sim.peakBrakeForceN);
      expect(viaProject.sim.termination).toBe(direct.sim.termination);
      expect(viaProject.sim.energy).toEqual(direct.sim.energy);
      expect(viaProject.sim.history.vMps).toEqual(direct.sim.history.vMps);
      expect(viaProject.warnings).toEqual(direct.warnings);
    });

    it(`status summary is identical for the ${label}`, () => {
      const project = buildCuftsProject(scenario);
      expect(summarizeProject(project)).toEqual(summarizeScenario(scenario));
    });
  }

  it('results survive a full export → import round trip', () => {
    const scenario = userScenario();
    const direct = summarizeScenario(scenario);
    const json = exportProjectJson(buildCuftsProject(scenario), '1.2.0');
    const imported = importProjectJson(json);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(summarizeProject(imported.project)).toEqual(direct);
  });
});

describe('CUFTS template topology', () => {
  const project = buildCuftsProject(exampleScenario);

  it('is a valid CUFTS project with intact referential integrity', () => {
    expect(isCuftsProject(project)).toBe(true);
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(checkProjectIntegrity(project)).toEqual([]);
  });

  it('places nodes at the layout geometry stations', () => {
    const site = exampleScenario.site;
    const byId = (id: string) => project.nodes.find((n) => n.id === id)!;
    const launch = globalPosition(byId(CUFTS_IDS.launchAnchorNode), project.coordinateSystems);
    const master = globalPosition(byId(CUFTS_IDS.masterNode), project.coordinateSystems);
    const capture = globalPosition(byId(CUFTS_IDS.capturePointNode), project.coordinateSystems);
    const ground = globalPosition(byId(CUFTS_IDS.brakeGroundNode), project.coordinateSystems);

    expect(launch).toEqual({ x: 0, y: 0, z: 0 });
    expect(master.x).toBeCloseTo(site.launchAnchorOffsetM, 9);
    expect(master.z).toBeCloseTo(site.highPointElevationM, 9);
    expect(capture.x).toBeCloseTo(site.launchAnchorOffsetM + site.horizontalSpanM, 9);
    expect(capture.z).toBeCloseTo(site.brakeAnchorElevationM, 9);
    // Capture terminus is decoupled from the ground beneath it (v1.1.0 model).
    expect(capture.z - ground.z).toBeCloseTo(site.captureHeightAboveGroundM, 9);
  });

  it('creates the expected element set with correct connectivity', () => {
    const cables = project.elements.filter(isCable);
    expect(cables.map((c) => c.id).sort()).toEqual(
      [CUFTS_IDS.backstayElement, CUFTS_IDS.mainLineElement].sort(),
    );
    const main = cables.find((c) => c.id === CUFTS_IDS.mainLineElement)!;
    expect(main.nodeIds).toEqual([CUFTS_IDS.masterNode, CUFTS_IDS.capturePointNode]);
    const backstay = cables.find((c) => c.id === CUFTS_IDS.backstayElement)!;
    expect(backstay.nodeIds).toEqual([CUFTS_IDS.launchAnchorNode, CUFTS_IDS.masterNode]);

    const masses = project.elements.filter(isPointMass);
    expect(masses).toHaveLength(1);
    expect(requireValue(masses[0].mass, 'trolley mass')).toBeCloseTo(
      exampleScenario.trolley.trolleyMassKg + exampleScenario.trolley.testArticleMassKg,
      9,
    );

    const brakes = project.elements.filter(isBrakeContact);
    expect(brakes).toHaveLength(1);
    expect(brakes[0].lawId).toBe(exampleScenario.brake.brakeLaw);
  });

  it('defines supports, load cases, moving body and analysis cases', () => {
    expect(project.supports.map((s) => s.nodeId)).toContain(CUFTS_IDS.masterNode);
    expect(project.loadCases).toHaveLength(2);
    expect(project.movingBodies).toHaveLength(1);
    expect(project.movingBodies[0].pathElementId).toBe(CUFTS_IDS.mainLineElement);
    expect(project.analysisCases.map((a) => a.solverId).sort()).toEqual(
      ['parabolic-v1', 'rk4-trolley-v1'].sort(),
    );
  });

  it('round-trips the scenario losslessly through the template', () => {
    expect(extractScenario(buildCuftsProject(exampleScenario))).toEqual(exampleScenario);
  });
});

describe('provenance rules', () => {
  it('marks example-scenario values as example, never verified', () => {
    const project = buildCuftsProject(exampleScenario);
    const main = project.elements.filter(isCable).find((c) => c.id === CUFTS_IDS.mainLineElement)!;
    expect(main.minBreakingStrength!.provenance.state).toBe('example');
    expect(project.verification.overallState).not.toBe('verified');
    expect(project.verification.engineerReviewed).toBe(false);
  });

  it('marks user-edited values as provisional, still not verified', () => {
    const project = buildCuftsProject(userScenario());
    const main = project.elements.filter(isCable).find((c) => c.id === CUFTS_IDS.mainLineElement)!;
    expect(main.minBreakingStrength!.provenance.state).toBe('provisional');
    expect(project.verification.overallState).not.toBe('verified');
  });

  it('represents un-entered ratings as MISSING, never zero (Rule 2)', () => {
    // The baseline example leaves brake capacity and trolley rating unentered.
    const project = buildCuftsProject(exampleScenario);
    const brake = project.elements.filter(isBrakeContact)[0];
    expect(isMissing(brake.forceCapacity)).toBe(true);
    expect(brake.forceCapacity!.value).toBeNull();
    expect(valueOrNull(brake.forceCapacity)).toBeNull();
    expect(isMissing(project.movingBodies[0].structuralRating)).toBe(true);
    expect(project.verification.overallState).toBe('missing');
    expect(project.verification.outstanding.join(' ')).toMatch(/not entered/i);
  });

  it('carries entered ratings through as real values', () => {
    const project = buildCuftsProject(userScenario());
    const brake = project.elements.filter(isBrakeContact)[0];
    expect(isMissing(brake.forceCapacity)).toBe(false);
    expect(requireValue(brake.forceCapacity, 'brake capacity')).toBeCloseTo(lbfToN(10000), 6);
  });

  it('records quantities absent from the v1 schema as missing, not defaulted', () => {
    const project = buildCuftsProject(userScenario());
    const main = project.elements.filter(isCable).find((c) => c.id === CUFTS_IDS.mainLineElement)!;
    // EA and unstretched length are required by M7 but not supplied by v1.
    expect(isMissing(main.axialStiffness)).toBe(true);
    expect(isMissing(main.unstretchedLength)).toBe(true);
    expect(main.axialStiffness!.provenance.notes).toMatch(/M7/);
    expect(isMissing(project.movingBodies[0].wheelRotaryInertia)).toBe(true);
  });

  it('requireValue throws rather than substituting a default', () => {
    const project = buildCuftsProject(exampleScenario);
    const brake = project.elements.filter(isBrakeContact)[0];
    expect(() => requireValue(brake.forceCapacity, 'brake capacity')).toThrow(/missing/i);
  });

  it('worstState aggregates to the least trustworthy input', () => {
    const project = buildCuftsProject(exampleScenario);
    const main = project.elements.filter(isCable).find((c) => c.id === CUFTS_IDS.mainLineElement)!;
    expect(worstState([main.linearMass, main.axialStiffness])).toBe('missing');
    expect(worstState([main.linearMass, main.designFactor])).toBe('example');
  });
});

describe('project serialization and migration', () => {
  it('migrates a legacy CUFTS scenario file into a project with disclosed notes', () => {
    const legacy = exportScenarioJson(exampleScenario, '1.1.0');
    const result = importProjectJson(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.template.id).toBe('cufts');
    expect(result.migrationNotes.some((n) => /CUFTS template/i.test(n))).toBe(true);
    // Migrated project reproduces v1 results exactly.
    expect(summarizeProject(result.project)).toEqual(summarizeScenario(exampleScenario));
  });

  it('migrates a legacy schema-v1 scenario file all the way to a project', () => {
    const raw = JSON.parse(JSON.stringify(exampleScenario)) as Record<string, any>;
    raw.schemaVersion = 1;
    delete raw.dynamics;
    delete raw.site.captureHeightAboveGroundM;
    delete raw.brake.brakeLaw;
    const result = importProjectJson(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.templateData.cufts!.schemaVersion).toBe(3);
    // Every filled field is disclosed, never silent.
    expect(result.migrationNotes.some((n) => /Migration/i.test(n))).toBe(true);
    expect(checkProjectIntegrity(result.project)).toEqual([]);
  });

  it('round-trips a project export/import losslessly', () => {
    const original = buildCuftsProject(userScenario(), {
      id: 'project-site-4',
      createdOn: '2026-07-21T00:00:00.000Z',
      revision: '3',
    });
    const result = importProjectJson(exportProjectJson(original, '1.2.0'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.id).toBe('project-site-4');
    expect(result.project.revision).toBe('3');
    expect(result.project.name).toBe(original.name);
    expect(extractScenario(result.project)).toEqual(extractScenario(original));
  });

  it('rejects malformed and unsupported project files', () => {
    expect(importProjectJson('{not json').ok).toBe(false);
    expect(importProjectJson(JSON.stringify({ fileType: 'talon-project' })).ok).toBe(false);

    const future = exportProjectJson(buildCuftsProject(exampleScenario), '1.2.0');
    const bumped = JSON.parse(future);
    bumped.project.schemaVersion = PROJECT_SCHEMA_VERSION + 1;
    const tooNew = importProjectJson(JSON.stringify(bumped));
    expect(tooNew.ok).toBe(false);
    if (!tooNew.ok) expect(tooNew.errors[0]).toMatch(/newer than this application/i);

    const unknownTemplate = JSON.parse(future);
    unknownTemplate.project.template.id = 'space-elevator';
    expect(importProjectJson(JSON.stringify(unknownTemplate)).ok).toBe(false);
  });

  it('rejects a project whose embedded scenario is invalid', () => {
    const file = JSON.parse(exportProjectJson(buildCuftsProject(exampleScenario), '1.2.0'));
    file.project.templateData.cufts.site.horizontalSpanM = 'very wide';
    const result = importProjectJson(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/horizontalSpanM/);
  });

  it('projectFromScenario preserves prior migration notes', () => {
    const { project, migrationNotes } = projectFromScenario(exampleScenario, ['prior note']);
    expect(migrationNotes[0]).toBe('prior note');
    expect(isCuftsProject(project)).toBe(true);
  });
});

describe('integrity checking', () => {
  it('detects dangling references', () => {
    const project = buildCuftsProject(exampleScenario);
    const broken = JSON.parse(JSON.stringify(project)) as typeof project;
    broken.elements[0].nodeIds[0] = 'node-does-not-exist';
    broken.supports[0].nodeId = 'node-also-missing';
    const issues = checkProjectIntegrity(broken);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/unknown node/);
  });

  it('reports a clean project as having no issues', () => {
    expect(checkProjectIntegrity(buildCuftsProject(userScenario()))).toEqual([]);
  });
});
