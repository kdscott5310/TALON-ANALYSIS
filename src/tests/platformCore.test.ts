/**
 * Milestone 6 — platform core: dimensions, coordinate systems, solver
 * contracts, immutable analysis runs, and the fixture-template registry.
 *
 * These cover the governance rules that must hold structurally:
 *   Rule 1  — nothing is ever certified
 *   Rule 2  — acceptance requires data, convergence, applicability, ratings
 *   Rule 3  — missing is never zero
 *   Rule 4  — unverified is never verified
 *   Rule 5  — derating preserves the original source value
 *   Rule 6  — results state units, frame, solver, version, fidelity
 *   Rule 9  — deterministic and reproducible
 *   Rule 11 — reduced-order is never presented as FEA
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BASE_EXPONENTS,
  SI_UNIT,
  dimensionsCompatible,
  productDimension,
  quotientDimension,
  type Dimension,
} from '../core/dimensions';
import {
  GLOBAL_CS_ID,
  directionToGlobal,
  frameVector,
  globalCoordinateSystem,
  pointToGlobal,
  vec3,
  type CoordinateSystem,
} from '../core/coordinates';
import {
  derate,
  isVerified,
  missing,
  provisional,
  quantity,
  summarizeConfidence,
  worstState,
  allVerified,
  STATE_LABEL,
  type VerificationState,
} from '../core/provenance';
import {
  APPLICABILITY_LABEL,
  FIDELITY_LABEL,
  PARABOLIC_STATIC_V1,
  RK4_TROLLEY_V1,
  assertFidelityClaim,
  buildResultBadge,
  combineApplicability,
  findSolver,
  listSolvers,
  overallAcceptance,
  registerBuiltInSolvers,
  registerSolver,
  resetSolverRegistry,
  type ApplicabilityCheck,
} from '../core/solver';
import {
  createAnalysisRun,
  describeRun,
  fingerprintContent,
  verifyRunIntegrity,
  type RunProvenance,
} from '../core/analysisRun';
import {
  FIXTURE_TEMPLATES,
  getTemplateInfo,
  implementedTemplates,
  instantiateTemplate,
  isTemplateImplemented,
  plannedTemplates,
} from '../core/templates/registry';
import { buildCuftsProject } from '../core/templates/cufts';
import { exampleScenario } from '../models/exampleScenario';
import { isFutureElementType } from '../core/elements';

describe('dimensional types (release gate 3)', () => {
  it('every dimension has an SI unit and base exponents', () => {
    for (const d of Object.keys(SI_UNIT) as Dimension[]) {
      expect(SI_UNIT[d].length).toBeGreaterThan(0);
      expect(BASE_EXPONENTS[d]).toHaveLength(4);
    }
  });

  it('detects compatible and incompatible dimensions', () => {
    expect(dimensionsCompatible('force', 'force')).toBe(true);
    expect(dimensionsCompatible('energy', 'moment')).toBe(true); // same base units
    expect(dimensionsCompatible('force', 'length')).toBe(false);
    expect(dimensionsCompatible('velocity', 'acceleration')).toBe(false);
  });

  it('computes dimensional algebra correctly', () => {
    expect(productDimension('force', 'length')).toBe('energy'); // N·m
    expect(quotientDimension('length', 'time')).toBe('velocity');
    expect(quotientDimension('velocity', 'time')).toBe('acceleration');
    expect(quotientDimension('force', 'length')).toBe('stiffness');
    expect(quotientDimension('mass', 'length')).toBe('linearDensity');
  });

  it('quantities carry their dimension and SI unit', () => {
    const f = provisional(1000, 'force');
    expect(f.dimension).toBe('force');
    expect(f.unit).toBe('N');
    const l = missing('length');
    expect(l.unit).toBe('m');
    expect(l.value).toBeNull();
  });
});

describe('coordinate systems (Rule 6)', () => {
  const systems: CoordinateSystem[] = [
    globalCoordinateSystem(),
    {
      id: 'cs-local',
      name: 'Local',
      kind: 'localElement',
      origin: vec3(10, 0, 5),
      rotation: null,
      parentId: GLOBAL_CS_ID,
    },
  ];

  it('resolves a point from a local frame into global', () => {
    expect(pointToGlobal(vec3(1, 2, 3), 'cs-local', systems)).toEqual({ x: 11, y: 2, z: 8 });
  });

  it('resolves a direction without applying translation', () => {
    expect(directionToGlobal(vec3(1, 0, 0), 'cs-local', systems)).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('applies rotation when present', () => {
    // 90° about z: x → y, y → −x
    const rotated: CoordinateSystem = {
      id: 'cs-rot',
      name: 'Rotated',
      kind: 'sensor',
      origin: vec3(0, 0, 0),
      rotation: [vec3(0, -1, 0), vec3(1, 0, 0), vec3(0, 0, 1)],
      parentId: GLOBAL_CS_ID,
    };
    const out = directionToGlobal(vec3(1, 0, 0), 'cs-rot', [...systems, rotated]);
    expect(out.x).toBeCloseTo(0, 12);
    expect(out.y).toBeCloseTo(1, 12);
  });

  it('rejects unknown frames and circular parent chains', () => {
    expect(() => pointToGlobal(vec3(0, 0, 0), 'cs-nope', systems)).toThrow(/Unknown coordinate/);
    const a: CoordinateSystem = {
      id: 'a', name: 'A', kind: 'sensor', origin: vec3(0, 0, 0), rotation: null, parentId: 'b',
    };
    const b: CoordinateSystem = {
      id: 'b', name: 'B', kind: 'sensor', origin: vec3(0, 0, 0), rotation: null, parentId: 'a',
    };
    expect(() => pointToGlobal(vec3(0, 0, 0), 'a', [a, b])).toThrow(/circular/);
  });

  it('frame vectors always state their frame and unit', () => {
    const v = frameVector(vec3(1, 2, 3), GLOBAL_CS_ID, 'N');
    expect(v.frameId).toBe(GLOBAL_CS_ID);
    expect(v.unit).toBe('N');
  });
});

describe('provenance rules (Rules 3, 4, 5)', () => {
  it('only manufacturer/user/internal states count as verified', () => {
    expect(isVerified('manufacturerVerified')).toBe(true);
    expect(isVerified('userVerified')).toBe(true);
    expect(isVerified('internallyTested')).toBe(true);
    // A distributor summary is explicitly NOT engineering proof (Rule 12).
    expect(isVerified('supplierListed')).toBe(false);
    expect(isVerified('importedUnverified')).toBe(false);
    expect(isVerified('exampleOnly')).toBe(false);
    expect(isVerified('estimated')).toBe(false);
    expect(isVerified('provisional')).toBe(false);
    expect(isVerified('obsolete')).toBe(false);
    expect(isVerified('missing')).toBe(false);
  });

  it('derating preserves the original source value (Rule 5)', () => {
    const published = quantity(10000, 'force', 'manufacturerVerified', {
      manufacturer: 'Example Rigging Co',
      sourceDocument: 'Catalog rev C',
    });
    const derated = derate(published, 0.8, 'Side-loading derate 0.8 per catalog note 4');
    expect(derated.value).toBeCloseTo(8000, 9);
    expect(derated.sourceValue).toBe(10000);
    expect(derated.provenance.deratingFactor).toBe(0.8);
    expect(derated.provenance.deratingRule).toMatch(/Side-loading/);
    // The source provenance survives derating.
    expect(derated.provenance.manufacturer).toBe('Example Rigging Co');
  });

  it('rejects a non-positive derating factor', () => {
    const q = provisional(100, 'force');
    expect(() => derate(q, 0, 'bad')).toThrow(/positive/);
    expect(() => derate(q, -1, 'bad')).toThrow(/positive/);
  });

  it('derating a missing value keeps it missing, never zero (Rule 3)', () => {
    const derated = derate(missing('force'), 0.5, 'any');
    expect(derated.value).toBeNull();
  });

  it('aggregates to the worst state and summarizes confidence', () => {
    const verified = quantity(1, 'force', 'manufacturerVerified');
    const example = quantity(2, 'force', 'exampleOnly');
    const gone = missing('force');
    expect(worstState([verified, example])).toBe('exampleOnly');
    expect(worstState([verified, gone])).toBe('missing');
    expect(allVerified([verified])).toBe(true);
    expect(allVerified([verified, example])).toBe(false);
    expect(summarizeConfidence([verified])).toBe('verified');
    expect(summarizeConfidence([verified, example])).toBe('mixed');
    expect(summarizeConfidence([example])).toBe('unverified');
    expect(summarizeConfidence([verified, gone])).toBe('insufficient');
  });

  it('labels example and imported data unmistakably', () => {
    expect(STATE_LABEL.exampleOnly).toMatch(/not for use/i);
    expect(STATE_LABEL.importedUnverified).toMatch(/UNVERIFIED/);
    expect(STATE_LABEL.missing).toMatch(/NOT ENTERED/);
  });
});

describe('solver contracts and fidelity (Rules 1, 2, 6, 11)', () => {
  beforeEach(() => {
    resetSolverRegistry();
    registerBuiltInSolvers();
  });

  it('registers the built-in v1 solvers as Level 1 reduced-order', () => {
    const solvers = listSolvers();
    expect(solvers).toHaveLength(2);
    for (const s of solvers) {
      expect(s.fidelity).toBe(1);
      expect(s.reducedOrder).toBe(true); // Rule 11
      expect(s.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(findSolver('cufts-parabolic-static')).toBeDefined();
    expect(findSolver('cufts-rk4-trolley', '1.0.0')).toBeDefined();
    expect(findSolver('nonexistent')).toBeUndefined();
  });

  it('refuses duplicate registration of the same solver version', () => {
    expect(() => registerSolver(PARABOLIC_STATIC_V1)).toThrow(/already registered/);
  });

  it('forbids claiming Level 3 without an imported external result', () => {
    expect(() => assertFidelityClaim(3, false)).toThrow(/cannot be claimed/i);
    expect(() => assertFidelityClaim(3, true)).not.toThrow();
    expect(() => assertFidelityClaim(2, false)).not.toThrow();
  });

  it('combines applicability checks to the worst status', () => {
    const mk = (status: ApplicabilityCheck['status']): ApplicabilityCheck => ({
      id: 'c', label: 'c', status, detail: 'd',
    });
    expect(combineApplicability([mk('validWithinLimits')])).toBe('validWithinLimits');
    expect(combineApplicability([mk('validWithinLimits'), mk('validWithCaution')])).toBe(
      'validWithCaution',
    );
    expect(combineApplicability([mk('validWithCaution'), mk('invalidInput')])).toBe('invalidInput');
    expect(combineApplicability([mk('outsideRecommended'), mk('didNotConverge')])).toBe(
      'didNotConverge',
    );
  });

  describe('acceptance decision (Rule 2)', () => {
    const base = {
      convergence: 'converged' as const,
      applicability: 'validWithinLimits' as const,
      inputConfidence: 'verified' as const,
      anyDemandExceedsRating: false,
      anyRequiredRatingUnknown: false,
      anyCriticalRiskOpen: false,
    };

    it('accepts only when everything is satisfied', () => {
      expect(overallAcceptance(base)).toBe('acceptablePreliminary');
    });

    it('is never acceptable when a demand exceeds a rating', () => {
      expect(overallAcceptance({ ...base, anyDemandExceedsRating: true })).toBe('notAcceptable');
    });

    it('is never acceptable when the solver did not converge', () => {
      expect(overallAcceptance({ ...base, convergence: 'notConverged' })).toBe('notAcceptable');
      expect(overallAcceptance({ ...base, convergence: 'diverged' })).toBe('notAcceptable');
      expect(overallAcceptance({ ...base, convergence: 'failed' })).toBe('notAcceptable');
    });

    it('is never acceptable outside the applicability range', () => {
      expect(overallAcceptance({ ...base, applicability: 'outsideRecommended' })).toBe(
        'notAcceptable',
      );
      expect(overallAcceptance({ ...base, applicability: 'physicallyInfeasible' })).toBe(
        'notAcceptable',
      );
      expect(overallAcceptance({ ...base, applicability: 'invalidInput' })).toBe('notAcceptable');
    });

    it('reports insufficient information rather than passing or failing', () => {
      expect(overallAcceptance({ ...base, anyRequiredRatingUnknown: true })).toBe(
        'insufficientInformation',
      );
      expect(overallAcceptance({ ...base, inputConfidence: 'insufficient' })).toBe(
        'insufficientInformation',
      );
      expect(overallAcceptance({ ...base, applicability: 'insufficientInformation' })).toBe(
        'insufficientInformation',
      );
    });

    it('is never acceptable while a critical risk is open', () => {
      expect(overallAcceptance({ ...base, anyCriticalRiskOpen: true })).toBe('notAcceptable');
    });

    it('downgrades to caution for unverified inputs', () => {
      expect(overallAcceptance({ ...base, inputConfidence: 'mixed' })).toBe('caution');
      expect(overallAcceptance({ ...base, applicability: 'validWithCaution' })).toBe('caution');
    });
  });

  it('builds a badge that always says Not certified (Rule 1)', () => {
    const badge = buildResultBadge(
      RK4_TROLLEY_V1,
      'validWithinLimits',
      'mixed',
      'caution',
    );
    expect(badge.certificationStatus).toBe('Not certified');
    expect(badge.analysisLevel).toBe(FIDELITY_LABEL[1]);
    expect(badge.solverVersion).toBe('1.0.0');
    expect(badge.applicability).toBe(APPLICABILITY_LABEL.validWithinLimits);
    expect(badge.reducedOrder).toBe(true);
  });
});

describe('immutable analysis runs (Rule 9)', () => {
  const provenance: RunProvenance = {
    projectRevision: '1',
    fixtureTemplateId: 'cufts',
    fixtureTemplateVersion: 3,
    scenarioRevision: 3,
    modelSchemaVersion: 2,
    solverId: PARABOLIC_STATIC_V1.id,
    solverVersion: PARABOLIC_STATIC_V1.version,
    sourceCommit: null,
    componentLibraryRevision: null,
    appVersion: '1.2.0',
  };

  function makeRun() {
    return createAnalysisRun({
      id: 'run-1',
      author: 'test',
      analysisCaseId: 'ac-static-sweep',
      provenance,
      inputSnapshot: { scenario: exampleScenario, settings: { sweepPositions: 21 } },
      coordinateSystems: [globalCoordinateSystem()],
      inputVerification: 'exampleOnly',
      ranOn: '2026-07-21T00:00:00.000Z',
      output: {
        descriptor: PARABOLIC_STATIC_V1,
        computedOn: '2026-07-21T00:00:00.000Z',
        primaryFrameId: GLOBAL_CS_ID,
        convergence: 'notApplicable',
        residuals: { force: 0 },
        scalars: [],
        vectors: [],
        intermediates: [],
        assumptions: ['Parabolic small-sag cable.'],
        applicabilityChecks: [],
        applicability: 'validWithinLimits',
        inputVerification: 'exampleOnly',
        inputConfidence: 'unverified',
        acceptance: 'caution',
        unresolvedLimitations: ['Elastic elongation neglected.'],
        warnings: [],
        badge: buildResultBadge(PARABOLIC_STATIC_V1, 'validWithinLimits', 'unverified', 'caution'),
      },
    });
  }

  it('freezes the run so it cannot be mutated', () => {
    const run = makeRun();
    expect(Object.isFrozen(run)).toBe(true);
    expect(() => {
      (run as { author: string }).author = 'someone else';
    }).toThrow();
    expect(Object.isFrozen(run.output)).toBe(true);
    expect(Object.isFrozen(run.inputSnapshot)).toBe(true);
  });

  it('snapshots inputs so later mutation cannot alter the archive', () => {
    const scenario = JSON.parse(JSON.stringify(exampleScenario));
    const run = createAnalysisRun({
      id: 'run-2',
      author: 'test',
      analysisCaseId: 'ac',
      provenance,
      inputSnapshot: { scenario, settings: {} },
      coordinateSystems: [globalCoordinateSystem()],
      inputVerification: 'exampleOnly',
      ranOn: '2026-07-21T00:00:00.000Z',
      output: makeRun().output,
    });
    scenario.site.horizontalSpanM = 99999;
    expect(run.inputSnapshot.scenario!.site.horizontalSpanM).not.toBe(99999);
  });

  it('verifies integrity and detects tampering', () => {
    const run = makeRun();
    expect(verifyRunIntegrity(run)).toBe(true);
    // Simulate an archived record edited outside the freeze (e.g. in storage).
    const tampered = JSON.parse(JSON.stringify(run)) as typeof run;
    (tampered as { author: string }).author = 'forged';
    expect(verifyRunIntegrity(tampered)).toBe(false);
  });

  it('produces a deterministic fingerprint independent of key order', () => {
    expect(fingerprintContent({ a: 1, b: 2 })).toBe(fingerprintContent({ b: 2, a: 1 }));
    expect(fingerprintContent({ a: 1 })).not.toBe(fingerprintContent({ a: 2 }));
    expect(makeRun().fingerprint).toBe(makeRun().fingerprint);
  });

  it('describes the run with fidelity, solver and certification status', () => {
    const lines = describeRun(makeRun()).join('\n');
    expect(lines).toMatch(/Analysis level:\s+Level 1/);
    expect(lines).toMatch(/Certification status:\s+Not certified/);
    expect(lines).toMatch(/Source commit:\s+not recorded/); // never fabricated
  });
});

describe('fixture template registry (Rule 11 — no claimed capability)', () => {
  it('declares the full catalogue with honest status', () => {
    expect(FIXTURE_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(implementedTemplates().map((t) => t.id)).toEqual(['cufts']);
    expect(plannedTemplates().length).toBeGreaterThanOrEqual(11);
    for (const t of plannedTemplates()) {
      expect(t.milestone).toMatch(/^M\d+/);
    }
  });

  it('instantiates the implemented CUFTS template', () => {
    expect(isTemplateImplemented('cufts')).toBe(true);
    const project = instantiateTemplate('cufts', exampleScenario);
    expect(project.template.id).toBe('cufts');
    expect(project.templateData.cufts).toEqual(exampleScenario);
  });

  it('refuses to instantiate a planned template rather than guessing a model', () => {
    expect(isTemplateImplemented('dropTestFixture')).toBe(false);
    expect(() => instantiateTemplate('dropTestFixture', exampleScenario)).toThrow(
      /planned for M10 and is not implemented/i,
    );
    expect(() => instantiateTemplate('railTrackFixture', exampleScenario)).toThrow(
      /not implemented/i,
    );
  });

  it('rejects an unknown template id', () => {
    expect(() =>
      instantiateTemplate('no-such-template' as never, exampleScenario),
    ).toThrow(/Unknown fixture template/);
  });

  it('names every template it declares', () => {
    for (const t of FIXTURE_TEMPLATES) {
      expect(getTemplateInfo(t.id)!.name.length).toBeGreaterThan(0);
    }
  });
});

describe('future element types are declared but not analyzed (Rule 11)', () => {
  it('flags beam/frame/shell/solid as future-only', () => {
    expect(isFutureElementType('beam')).toBe(true);
    expect(isFutureElementType('frame')).toBe(true);
    expect(isFutureElementType('shellExport')).toBe(true);
    expect(isFutureElementType('solidExport')).toBe(true);
    expect(isFutureElementType('cable')).toBe(false);
    expect(isFutureElementType('pointMass')).toBe(false);
  });
});

describe('CUFTS project records assumptions and verification honestly', () => {
  const project = buildCuftsProject(exampleScenario);

  it('carries the v1 modeling assumptions with a resolution path', () => {
    expect(project.assumptions.length).toBeGreaterThanOrEqual(4);
    for (const a of project.assumptions) {
      expect(a.statement.length).toBeGreaterThan(10);
      expect(a.resolutionPath).toBeTruthy();
    }
    expect(project.assumptions.map((a) => a.statement).join(' ')).toMatch(/parabolic/i);
  });

  it('starts as an unreviewed draft — the software never self-certifies', () => {
    expect(project.verification.reviewStatus).toBe('draft');
    expect(project.verification.engineerReviewed).toBe(false);
  });

  it('declares a service load combination with no assumed code factors', () => {
    expect(project.loadCombinations).toHaveLength(1);
    expect(project.loadCombinations[0].standard).toBeUndefined();
    expect(project.loadCombinations[0].notes).toMatch(/no building-code combination/i);
  });

  it('defines the crane and trolley-path coordinate systems', () => {
    const kinds = project.coordinateSystems.map((c) => c.kind).sort();
    expect(kinds).toEqual(['crane', 'global', 'trolleyPath']);
  });

  it('models ballast anchors as support elements with dead weight', () => {
    const supports = project.elements.filter((e) => e.type === 'supportElement');
    expect(supports).toHaveLength(2);
  });

  it('never marks a verification state as verified for example data (Rule 4)', () => {
    const states: VerificationState[] = [project.verification.overallState];
    expect(states.every((s) => !isVerified(s))).toBe(true);
  });
});
