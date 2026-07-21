/**
 * Ground-clearance decoupling + flight-zone scoping (schema v3).
 *
 * Reproduces the reported "-4.0 ft FAILED" case (capture terminus pinned
 * to grade, requirement enforced through the capture point) and verifies:
 *  - the flight-zone scope excludes the brake/capture zones,
 *  - capture height above ground decouples the terminus from terrain,
 *  - v2 → v3 migration fills the new field, and
 *  - validation rejects a negative capture height.
 */
import { describe, it, expect } from 'vitest';
import { runStaticAnalysis } from '../calculations/staticAnalysis';
import { summarizeScenario } from '../calculations/statusSummary';
import { validateScenario } from '../validation/validate';
import { migrateScenario, CURRENT_SCHEMA_VERSION } from '../models/scenarioSerialization';
import { exampleScenario } from '../models/exampleScenario';
import type { Scenario } from '../models/scenario';
import { ftToM, lbToKg } from '../units/units';

function clone(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

/** The configuration from the user's report (capture at grade). */
function reportedScenario(): Scenario {
  const s = clone(exampleScenario);
  s.site.horizontalSpanM = ftToM(1000);
  s.site.highPointElevationM = ftToM(200);
  s.site.brakeAnchorElevationM = ftToM(6);
  s.site.captureHeightAboveGroundM = 0; // capture on the ground
  s.site.launchAnchorOffsetM = ftToM(600);
  s.site.brakeZoneLengthM = ftToM(150);
  s.site.captureZoneLengthM = ftToM(50);
  s.site.minGroundClearanceM = ftToM(4);
  s.trolley.testArticleMassKg = lbToKg(100);
  s.trolley.payloadDropM = 0;
  return s;
}

describe('flight-zone scoping', () => {
  it("the reported scenario's clearance is no longer failed by the capture terminus", () => {
    const s = reportedScenario();
    const summary = summarizeScenario(s);
    const gc = summary.items.find((i) => i.key === 'ground-clearance')!;
    // The only sub-minimum point was the terminus at ~0 ft; excluding the
    // brake+capture zones, the flight span clears the required 4 ft.
    expect(gc.status).not.toBe('failed');
    expect(gc.valueSI).toBeGreaterThan(0);
  });

  it('excludes the brake + capture zones from the clearance sweep', () => {
    const s = reportedScenario();
    const r = runStaticAnalysis({ scenario: s, trolleyPositionFrac: 1 });
    // Margin is measured only up to brake entry (span − brake − capture),
    // so the terminus zero-clearance point cannot drive it negative here.
    expect(r.groundClearanceMarginM).toBeGreaterThan(0);
  });
});

describe('capture height decouples the terminus from terrain', () => {
  it('raising capture height above ground increases the clearance margin', () => {
    const low = reportedScenario();
    const high = clone(low);
    high.site.captureHeightAboveGroundM = ftToM(6); // terrain drops 6 ft below the terminus
    const rl = runStaticAnalysis({ scenario: low, trolleyPositionFrac: 0.5 });
    const rh = runStaticAnalysis({ scenario: high, trolleyPositionFrac: 0.5 });
    expect(rh.groundClearanceMarginM).toBeGreaterThan(rl.groundClearanceMarginM);
  });

  it('default capture height of 0 reproduces capture-at-grade terrain', () => {
    // With capture height 0, the brake-end terrain equals the terminus
    // elevation, matching the pre-v3 model within the flight span.
    const s = reportedScenario();
    expect(s.site.captureHeightAboveGroundM).toBe(0);
    const r = runStaticAnalysis({ scenario: s, trolleyPositionFrac: 0.3 });
    expect(Number.isFinite(r.groundClearanceMarginM)).toBe(true);
  });
});

describe('schema v2 → v3 migration', () => {
  it('fills captureHeightAboveGroundM with 0 and notes the fill', () => {
    const raw = JSON.parse(JSON.stringify(exampleScenario)) as Record<string, any>;
    raw.schemaVersion = 2;
    delete raw.site.captureHeightAboveGroundM;
    const result = migrateScenario(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenario.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.scenario.site.captureHeightAboveGroundM).toBe(0);
    expect(result.migrationNotes.some((n) => /capture height/i.test(n))).toBe(true);
  });
});

describe('validation', () => {
  it('rejects a negative capture height', () => {
    const s = reportedScenario();
    s.site.captureHeightAboveGroundM = -1;
    const v = validateScenario(s);
    expect(v.isValid).toBe(false);
    expect(v.issues.some((i) => i.field === 'site.captureHeightAboveGroundM')).toBe(true);
  });

  it('accepts a valid positive capture height', () => {
    const s = reportedScenario();
    s.site.captureHeightAboveGroundM = ftToM(8);
    const v = validateScenario(s);
    expect(v.issues.some((i) => i.field === 'site.captureHeightAboveGroundM' && i.severity === 'error')).toBe(false);
  });
});
