/**
 * Milestone 4 — scenario serialization, migration, status summary,
 * report data assembly, and CSV export tests.
 */
import { describe, it, expect } from 'vitest';
import {
  exportScenarioJson,
  importScenarioJson,
  migrateScenario,
  CURRENT_SCHEMA_VERSION,
} from '../models/scenarioSerialization';
import { summarizeScenario } from '../calculations/statusSummary';
import { buildReportData } from '../reports/reportData';
import { summaryCsv, timeHistoryCsv } from '../reports/csv';
import { runDynamicsAnalysis } from '../calculations/dynamicsAnalysis';
import { exampleScenario } from '../models/exampleScenario';
import type { Scenario } from '../models/scenario';

function clone(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

/** Builds a legacy schema-v1 payload (pre-Milestone-3 fields removed). */
function legacyV1Payload(): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(exampleScenario)) as Record<string, any>;
  raw.schemaVersion = 1;
  delete raw.dynamics;
  delete raw.trolley.rollingResistanceCoeff;
  delete raw.trolley.dragAreaM2;
  delete raw.trolley.trolleyStructuralRatingN;
  delete raw.brake.brakeLaw;
  delete raw.brake.brakeForceN;
  delete raw.brake.velocityCoeffNsPerM;
  delete raw.brake.brakeCapacityN;
  delete raw.environment.alongTrackWindMps;
  delete raw.environment.airDensityKgPerM3;
  return raw;
}

describe('scenario serialization', () => {
  it('export → import round-trip preserves the scenario exactly', () => {
    const json = exportScenarioJson(exampleScenario, '0.5.0');
    const result = importScenarioJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario).toEqual(exampleScenario);
      expect(result.migrationNotes).toEqual([]);
    }
  });

  it('accepts a bare scenario object without the envelope', () => {
    const result = importScenarioJson(JSON.stringify(exampleScenario));
    expect(result.ok).toBe(true);
  });

  it('drops unknown fields on import', () => {
    const raw = JSON.parse(JSON.stringify(exampleScenario));
    raw.maliciousExtra = 'ignored';
    raw.site.bogus = 123;
    const result = importScenarioJson(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('maliciousExtra' in result.scenario).toBe(false);
      expect('bogus' in result.scenario.site).toBe(false);
    }
  });

  it('rejects invalid JSON, wrong fileType, and unsupported schema versions', () => {
    expect(importScenarioJson('not json {').ok).toBe(false);
    expect(importScenarioJson(JSON.stringify({ fileType: 'other-app', scenario: {} })).ok).toBe(false);
    const badVersion = JSON.parse(JSON.stringify(exampleScenario));
    badVersion.schemaVersion = 99;
    const result = importScenarioJson(JSON.stringify(badVersion));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/schemaVersion/);
  });

  it('rejects structurally invalid data (non-numeric fields, bad enums)', () => {
    const badNum = JSON.parse(JSON.stringify(exampleScenario));
    badNum.site.horizontalSpanM = 'wide';
    const r1 = importScenarioJson(JSON.stringify(badNum));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.some((e) => e.includes('site.horizontalSpanM'))).toBe(true);

    const badEnum = JSON.parse(JSON.stringify(exampleScenario));
    badEnum.brake.brakeLaw = 'anti-gravity';
    const r2 = importScenarioJson(JSON.stringify(badEnum));
    expect(r2.ok).toBe(false);

    const noSite = JSON.parse(JSON.stringify(exampleScenario));
    delete noSite.site;
    expect(importScenarioJson(JSON.stringify(noSite)).ok).toBe(false);
  });
});

describe('schema migration v1 → v2', () => {
  it('fills missing Milestone-3 fields with provisional defaults and notes each fill', () => {
    const result = migrateScenario(legacyV1Payload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenario.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.scenario.trolley.rollingResistanceCoeff).toBe(0.015);
    expect(result.scenario.trolley.dragAreaM2).toBe(0.4);
    expect(result.scenario.brake.brakeLaw).toBe('constant-force');
    expect(result.scenario.environment.airDensityKgPerM3).toBe(1.225);
    expect(result.scenario.dynamics.timeStepS).toBe(0.01);
    // every filled field is disclosed
    expect(result.migrationNotes.length).toBeGreaterThanOrEqual(9);
    expect(result.migrationNotes.every((n) => /Migration/.test(n))).toBe(true);
  });

  it('migrated v1 scenarios remain usable by the solvers', () => {
    const result = migrateScenario(legacyV1Payload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // brakeForceN defaults to 0 (no braking claimed) — simulation must
    // still run and report the stopping failure rather than invent a brake.
    const dyn = runDynamicsAnalysis(result.scenario);
    expect(dyn.sim.history.tS.length).toBeGreaterThan(10);
    expect(
      dyn.warnings.some((w) => w.severity === 'critical' && /STOPPING FAILURE/.test(w.message)),
    ).toBe(true);
  });
});

describe('status summary', () => {
  it('summarizes the example scenario with traceable items', () => {
    const s = summarizeScenario(exampleScenario);
    expect(s.solverError).toBeNull();
    expect(s.items.length).toBeGreaterThanOrEqual(12);
    for (const item of s.items) {
      expect(item.solver.length).toBeGreaterThan(0);
      expect(item.inputs.length).toBeGreaterThan(0);
      expect(item.assumptions.length).toBeGreaterThan(0);
      expect(item.detail.length).toBeGreaterThan(0);
    }
    const cable = s.items.find((i) => i.key === 'cable-utilization')!;
    expect(cable.status).toBe('ok'); // ~48% utilization in the example
  });

  it('marks un-entered ratings as insufficient — never zero or acceptable', () => {
    const s = summarizeScenario(exampleScenario);
    const brakeCap = s.items.find((i) => i.key === 'brake-capacity')!;
    expect(brakeCap.status).toBe('insufficient');
    expect(brakeCap.valueSI).toBeNull();
    expect(brakeCap.text).toBe('NOT ENTERED');
    const rating = s.items.find((i) => i.key === 'trolley-rating')!;
    expect(rating.status).toBe('insufficient');
  });

  it('propagates failed checks to the overall status', () => {
    // Example scenario peaks slightly above the 3 g deceleration limit.
    const s = summarizeScenario(exampleScenario);
    const decel = s.items.find((i) => i.key === 'peak-decel')!;
    expect(decel.status).toBe('failed');
    expect(s.overall).toBe('failed');
  });

  it('reports invalid inputs as a solver error with results withheld', () => {
    const bad = clone(exampleScenario);
    bad.site.horizontalSpanM = -5;
    const s = summarizeScenario(bad);
    expect(s.overall).toBe('error');
    expect(s.items.length).toBe(0);
    expect(s.solverError).toMatch(/validation error/);
  });
});

describe('report data assembly', () => {
  it('assembles metadata, input sections, summary, and disclaimer', () => {
    const r = buildReportData(exampleScenario, '0.5.0', 'us');
    expect(r.meta.scenarioName).toBe(exampleScenario.name);
    expect(r.meta.unverifiedExample).toBe(true);
    expect(r.inputs.length).toBe(7);
    expect(r.summary.items.length).toBeGreaterThan(0);
    expect(r.disclaimer).toMatch(/preliminary engineering estimates/i);
  });

  it('shows missing ratings as NOT ENTERED, never zero', () => {
    const r = buildReportData(exampleScenario, '0.5.0', 'us');
    const brakeRows = r.inputs.find((s) => s.title === 'Brake & dynamics')!.rows;
    const cap = brakeRows.find((row) => row.label === 'Brake capacity')!;
    expect(cap.value).toBe('NOT ENTERED');
    const trolleyRows = r.inputs.find((s) => s.title === 'Trolley & payload')!.rows;
    const rating = trolleyRows.find((row) => row.label === 'Structural rating')!;
    expect(rating.value).toBe('NOT ENTERED');
  });
});

describe('CSV export', () => {
  it('summary CSV includes headers, statuses, and the disclaimer', () => {
    const csv = summaryCsv(summarizeScenario(exampleScenario));
    expect(csv).toMatch(/check,value \(SI\),unit,status/);
    expect(csv).toMatch(/insufficient/);
    expect(csv).toMatch(/DISCLAIMER/);
    // insufficient rows export an empty value cell, not 0
    const capLine = csv.split('\n').find((l) => l.startsWith('Brake capacity check'))!;
    expect(capLine.split(',')[1]).toBe('');
  });

  it('escapes commas and quotes in CSV cells', () => {
    const s = summarizeScenario(exampleScenario);
    const renamed = { ...s, scenarioName: 'span, "big" test' };
    const csv = summaryCsv(renamed);
    expect(csv).toContain('"span, ""big"" test"');
  });

  it('time-history CSV has one row per sample plus a header', () => {
    const dyn = runDynamicsAnalysis(exampleScenario);
    const csv = timeHistoryCsv(dyn.sim);
    const lines = csv.split('\n');
    expect(lines[0]).toMatch(/t \(s\)/);
    expect(lines.length).toBe(dyn.sim.history.tS.length + 1);
  });
});
