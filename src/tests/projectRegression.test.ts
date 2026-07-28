/**
 * Milestone 6H — serialization, migration & the M6 headline regression.
 *
 * Proves that taking a v1 CUFTS scenario ALL THE WAY through the generalized
 * platform — scenario → project → exported JSON → imported project → solved via
 * the project adapters — yields results BIT-FOR-BIT identical to the validated
 * v1 solvers. The generalized platform must never change a validated number
 * (Rule 1 / release gate 17).
 */
import { describe, it, expect } from 'vitest';
import {
  exportProjectJson,
  importProjectJson,
  projectFromScenario,
} from '../core/projectSerialization';
import {
  analyzeProjectStatic,
  analyzeProjectDynamics,
  summarizeProject,
} from '../core/projectAnalysis';
import { extractScenario } from '../core/templates/cufts';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { runDynamicsAnalysis } from '../calculations/dynamicsAnalysis';
import { summarizeScenario } from '../calculations/statusSummary';
import { exampleScenario } from '../models/exampleScenario';

/** Scenario → project → JSON → imported project (the full durability path). */
function throughProjectPath() {
  const { project, migrationNotes } = projectFromScenario(exampleScenario);
  const imported = importProjectJson(exportProjectJson(project, '1.1.0'));
  if (!imported.ok) throw new Error(`round-trip failed: ${imported.errors.join(' ')}`);
  return { project: imported.project, migrationNotes };
}

describe('v1 → project migration', () => {
  it('wraps a v1 scenario as a CUFTS project with disclosed notes, no data loss', () => {
    const { project, migrationNotes } = projectFromScenario(exampleScenario);
    expect(project.template.id).toBe('cufts');
    expect(migrationNotes.length).toBeGreaterThan(0); // disclosed, never silent
    // The authoritative scenario is preserved verbatim.
    expect(extractScenario(project)).toEqual(exampleScenario);
  });

  it('rejects a malformed project file with an explicit reason', () => {
    const bad = importProjectJson('{ not valid json');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/not valid json/i);
  });
});

describe('exact-equality regression through the full project path', () => {
  it('preserves the CUFTS scenario verbatim across serialization', () => {
    const { project } = throughProjectPath();
    expect(extractScenario(project)).toEqual(exampleScenario);
  });

  it('static results equal the v1 solver at every swept position', () => {
    const { project } = throughProjectPath();
    for (const frac of [0, 0.3, 0.5, 0.75, 1]) {
      expect(analyzeProjectStatic(project, frac)).toEqual(
        runStaticAnalysis({ scenario: exampleScenario, trolleyPositionFrac: frac }),
      );
    }
  });

  it('dynamic results equal the v1 solver', () => {
    const { project } = throughProjectPath();
    // The dynamics result caches derived interpolation FUNCTIONS on `path`
    // (distinct closures per call), so compare the serializable data — the
    // numbers that drive results, reports, and persistence — bit-for-bit.
    const serializable = (x: unknown) => JSON.parse(JSON.stringify(x));
    expect(serializable(analyzeProjectDynamics(project))).toEqual(
      serializable(runDynamicsAnalysis(exampleScenario)),
    );
  });

  it('the status summary equals the v1 summary', () => {
    const { project } = throughProjectPath();
    expect(summarizeProject(project)).toEqual(summarizeScenario(exampleScenario));
  });
});
