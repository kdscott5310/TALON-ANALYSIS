/**
 * Milestone 6G — analysis-run wiring & fidelity badges.
 *
 * Verifies the run/badge contract around the validated v1 result: honest
 * fidelity, "Not certified", reproducibility, missing≠OK, and that custom
 * projects get an explicit "no solver" result rather than a fabricated one.
 */
import { describe, it, expect } from 'vitest';
import { runProjectAnalysis } from '../core/projectRun';
import { verifyRunIntegrity } from '../core/analysisRun';
import { buildCuftsProject } from '../core/templates/cufts';
import { summarizeProject } from '../core/projectAnalysis';
import { createCustomProject } from '../core/templates/custom';
import { exampleScenario } from '../models/exampleScenario';

const RUN_OPTS = { appVersion: '1.1.0', ranOn: '2026-07-24T00:00:00.000Z', runId: 'run-fixed' };

describe('CUFTS analysis run', () => {
  it('produces a frozen Level-1, Not-certified run', () => {
    const result = runProjectAnalysis(buildCuftsProject(exampleScenario), RUN_OPTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { run } = result;

    expect(run.output.descriptor.fidelity).toBe(1);
    expect(run.output.badge.analysisLevel).toMatch(/Level 1/);
    expect(run.output.badge.certificationStatus).toBe('Not certified');
    expect(run.output.convergence).toBe('converged');
    expect(run.provenance.solverId).toBe('cufts-parabolic-static');
    expect(verifyRunIntegrity(run)).toBe(true);
    expect(run.unitSystem).toBe('SI');
  });

  it('maps the v1 summary status faithfully and never coerces missing to zero', () => {
    const project = buildCuftsProject(exampleScenario);
    const summary = summarizeProject(project);
    const result = runProjectAnalysis(project, RUN_OPTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const acceptanceByOverall: Record<string, string> = {
      ok: 'acceptablePreliminary',
      caution: 'caution',
      insufficient: 'insufficientInformation',
      failed: 'notAcceptable',
      error: 'notAcceptable',
    };
    expect(result.run.output.acceptance).toBe(acceptanceByOverall[summary.overall]);

    // Any not-evaluated check is a missing quantity (value null), never 0.
    for (const s of result.run.output.scalars) {
      if (s.quantity.value === null) expect(s.quantity.provenance.state).toBe('missing');
    }
    expect(result.run.output.scalars.length).toBeGreaterThan(0);
  });

  it('is reproducible: identical inputs → identical run', () => {
    const project = buildCuftsProject(exampleScenario);
    const a = runProjectAnalysis(project, RUN_OPTS);
    const b = runProjectAnalysis(project, RUN_OPTS);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.run.fingerprint).toBe(b.run.fingerprint);
      expect(a.run).toEqual(b.run);
    }
  });
});

describe('custom project analysis', () => {
  it('returns an explicit no-solver result rather than a fabricated run', () => {
    const result = runProjectAnalysis(createCustomProject(), RUN_OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no analysis solver|deferred|custom/i);
  });
});
