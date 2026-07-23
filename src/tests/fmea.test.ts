/**
 * Milestone 14 — FMEA / hazard register.
 *
 * Focus: RPN = S×O×D, criticality banding, open-risk propagation, and the
 * governance rule that seeded starter content is always labeled and never
 * presented as complete/approved.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStarterFmea,
  byPriority,
  createRegister,
  criticality,
  isOpen,
  openCriticalOrHighRisks,
  rpn,
  setStatus,
  summarizeFmea,
  type FmeaEntry,
} from '../core/fmea';

function entry(over: Partial<FmeaEntry> = {}): FmeaEntry {
  return {
    id: 'e1',
    subsystem: 'Test',
    failureMode: 'Mode',
    severity: 5,
    occurrence: 5,
    detection: 5,
    status: 'open',
    starterContent: false,
    ...over,
  };
}

describe('RPN and criticality', () => {
  it('computes RPN = S × O × D', () => {
    expect(rpn(entry({ severity: 10, occurrence: 2, detection: 4 }))).toBe(80);
    expect(rpn(entry({ severity: 8, occurrence: 5, detection: 5 }))).toBe(200);
  });

  it('bands criticality by RPN with a severity override', () => {
    expect(criticality(entry({ severity: 2, occurrence: 2, detection: 2 }))).toBe('low'); // 8
    expect(criticality(entry({ severity: 5, occurrence: 4, detection: 3 }))).toBe('moderate'); // 60
    expect(criticality(entry({ severity: 5, occurrence: 5, detection: 5 }))).toBe('high'); // 125
    expect(criticality(entry({ severity: 4, occurrence: 5, detection: 5 }))).toBe('high'); // 100
    // Severity-9 catastrophic effect with RPN≥100 is critical.
    expect(criticality(entry({ severity: 9, occurrence: 4, detection: 3 }))).toBe('critical'); // 108
    // A catastrophic-severity mode is never below 'high', even at low RPN.
    expect(criticality(entry({ severity: 10, occurrence: 2, detection: 4 }))).toBe('high'); // 80
  });
});

describe('open-risk propagation (Rule 2)', () => {
  it('lists open critical/high risks, worst first', () => {
    const reg = createRegister([
      entry({ id: 'crit', severity: 10, occurrence: 5, detection: 5 }), // 250 critical, open
      entry({ id: 'high', severity: 4, occurrence: 5, detection: 5 }), // 100 high, open
      entry({ id: 'low', severity: 2, occurrence: 2, detection: 2 }), // 8 low, open
      entry({ id: 'closedCrit', severity: 10, occurrence: 5, detection: 5, status: 'closed' }),
    ]);
    const open = openCriticalOrHighRisks(reg);
    expect(open.map((e) => e.id)).toEqual(['crit', 'high']); // low excluded, closed excluded
  });

  it('an accepted or closed entry is not open', () => {
    expect(isOpen(entry({ status: 'accepted' }))).toBe(false);
    expect(isOpen(entry({ status: 'closed' }))).toBe(false);
    expect(isOpen(entry({ status: 'mitigated' }))).toBe(true); // still tracked
  });

  it('setStatus transitions an entry and clears it from the open list', () => {
    let reg = createRegister([entry({ id: 'crit', severity: 10, occurrence: 5, detection: 5 })]);
    expect(openCriticalOrHighRisks(reg)).toHaveLength(1);
    reg = setStatus(reg, 'crit', 'closed');
    expect(openCriticalOrHighRisks(reg)).toHaveLength(0);
  });
});

describe('register summary and ordering', () => {
  it('sorts by descending RPN', () => {
    const reg = createRegister([
      entry({ id: 'a', severity: 2, occurrence: 2, detection: 2 }),
      entry({ id: 'b', severity: 10, occurrence: 5, detection: 5 }),
      entry({ id: 'c', severity: 5, occurrence: 5, detection: 4 }),
    ]);
    expect(byPriority(reg).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('summarizes open/closed and critical counts', () => {
    const reg = createRegister([
      entry({ id: 'crit', severity: 10, occurrence: 5, detection: 5 }),
      entry({ id: 'closed', severity: 10, occurrence: 5, detection: 5, status: 'closed' }),
    ]);
    const s = summarizeFmea(reg);
    expect(s.total).toBe(2);
    expect(s.open).toBe(1);
    expect(s.closed).toBe(1);
    expect(s.criticalOpen).toBe(1);
    expect(s.hasOpenCriticalOrHigh).toBe(true);
    expect(s.maxRpn).toBe(250);
  });
});

describe('seeded starter FMEA (Rule: seeds are starter content)', () => {
  const reg = buildStarterFmea();

  it('provides a representative set of failure modes', () => {
    expect(reg.entries.length).toBeGreaterThanOrEqual(20);
    const modes = reg.entries.map((e) => e.failureMode.toLowerCase()).join(' ');
    expect(modes).toMatch(/cable rupture/);
    expect(modes).toMatch(/brake failure/);
    expect(modes).toMatch(/anchor/);
  });

  it('every seeded entry is labeled starter content and open', () => {
    for (const e of reg.entries) {
      expect(e.starterContent).toBe(true);
      expect(e.status).toBe('open');
      expect(e.recommendedMitigation).toMatch(/starter content/i);
    }
    expect(summarizeFmea(reg).hasStarterContent).toBe(true);
  });

  it('surfaces open critical/high risks for the report and status', () => {
    const open = openCriticalOrHighRisks(reg);
    expect(open.length).toBeGreaterThan(0);
    // Cable rupture (S10) should be among the top risks.
    expect(open.some((e) => e.id === 'fm-cable-rupture')).toBe(true);
  });
});
