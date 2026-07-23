/**
 * FMEA and hazard register — Milestone 14.
 *
 * Failure-mode-and-effects entries with severity, occurrence, detection, RPN,
 * mitigations, owners, evidence, and closure status. Seeded starter modes are
 * clearly labeled starter content requiring engineering review (Rule 5 of the
 * platform: seeds never present as complete or approved).
 *
 * Open critical/high risks propagate: `openCriticalOrHighRisks` feeds the
 * acceptance decision so a result is never "acceptable" while such a risk is
 * unresolved (governance Rule 2).
 */

/** Severity / occurrence / detection are 1–10 ratings (higher = worse). */
export type Rating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type FmeaStatus = 'open' | 'inProgress' | 'mitigated' | 'accepted' | 'closed';

export interface FmeaEntry {
  id: string;
  subsystem: string;
  component?: string;
  functionText?: string;
  failureMode: string;
  cause?: string;
  localEffect?: string;
  systemEffect?: string;
  detectionMethod?: string;
  existingControl?: string;
  severity: Rating;
  occurrence: Rating;
  detection: Rating;
  recommendedMitigation?: string;
  owner?: string;
  dueDate?: string;
  evidence?: string;
  status: FmeaStatus;
  /** True for seeded starter content requiring engineering review. */
  starterContent: boolean;
}

/** Risk priority number = S × O × D (1..1000). */
export function rpn(entry: Pick<FmeaEntry, 'severity' | 'occurrence' | 'detection'>): number {
  return entry.severity * entry.occurrence * entry.detection;
}

/** Criticality bands by RPN and severity, for reporting. */
export type Criticality = 'low' | 'moderate' | 'high' | 'critical';

export function criticality(entry: FmeaEntry): Criticality {
  const r = rpn(entry);
  // Catastrophic-severity failure modes are never downgraded below 'high' just
  // because they are rare or detectable — they must always surface in the
  // report (governance: unresolved high-risk items are always reported).
  if (r >= 200 || (entry.severity >= 9 && r >= 100)) return 'critical';
  if (r >= 100 || entry.severity >= 9) return 'high';
  if (r >= 40 || entry.severity >= 7) return 'moderate';
  return 'low';
}

/** True when an entry still demands action (not closed/accepted). */
export function isOpen(entry: FmeaEntry): boolean {
  return entry.status === 'open' || entry.status === 'inProgress' || entry.status === 'mitigated';
}

export interface FmeaRegister {
  schemaVersion: number;
  entries: FmeaEntry[];
}

export const FMEA_SCHEMA_VERSION = 1;

export function createRegister(entries: FmeaEntry[] = []): FmeaRegister {
  return { schemaVersion: FMEA_SCHEMA_VERSION, entries };
}

/** Entries sorted by descending RPN (highest priority first). */
export function byPriority(register: FmeaRegister): FmeaEntry[] {
  return [...register.entries].sort((a, b) => rpn(b) - rpn(a));
}

/** Open entries whose criticality is high or critical — these block acceptance. */
export function openCriticalOrHighRisks(register: FmeaRegister): FmeaEntry[] {
  return register.entries
    .filter((e) => isOpen(e) && (criticality(e) === 'critical' || criticality(e) === 'high'))
    .sort((a, b) => rpn(b) - rpn(a));
}

export interface FmeaSummary {
  total: number;
  open: number;
  closed: number;
  criticalOpen: number;
  highOpen: number;
  maxRpn: number;
  /** True when any open entry is high or critical. */
  hasOpenCriticalOrHigh: boolean;
  /** True when any entry is still labeled starter content. */
  hasStarterContent: boolean;
}

export function summarizeFmea(register: FmeaRegister): FmeaSummary {
  const open = register.entries.filter(isOpen);
  const criticalOpen = open.filter((e) => criticality(e) === 'critical').length;
  const highOpen = open.filter((e) => criticality(e) === 'high').length;
  return {
    total: register.entries.length,
    open: open.length,
    closed: register.entries.length - open.length,
    criticalOpen,
    highOpen,
    maxRpn: register.entries.reduce((m, e) => Math.max(m, rpn(e)), 0),
    hasOpenCriticalOrHigh: criticalOpen + highOpen > 0,
    hasStarterContent: register.entries.some((e) => e.starterContent),
  };
}

/** Transitions an entry's status, recording nothing silently invalid. */
export function setStatus(register: FmeaRegister, id: string, status: FmeaStatus): FmeaRegister {
  return {
    ...register,
    entries: register.entries.map((e) => (e.id === id ? { ...e, status } : e)),
  };
}

// ── seeded starter failure modes ────────────────────────────────────────────

const STARTER_NOTE = 'Starter content — review, re-rate, and complete for this specific system.';

function seed(
  id: string,
  subsystem: string,
  failureMode: string,
  systemEffect: string,
  severity: Rating,
  occurrence: Rating,
  detection: Rating,
): FmeaEntry {
  return {
    id,
    subsystem,
    failureMode,
    systemEffect,
    severity,
    occurrence,
    detection,
    recommendedMitigation: STARTER_NOTE,
    status: 'open',
    starterContent: true,
  };
}

/**
 * Builds a starter FMEA register with representative cable/trolley/brake/anchor
 * failure modes. EVERY entry is `starterContent: true` and its ratings are
 * placeholders to be re-rated for the specific system — a test asserts this.
 */
export function buildStarterFmea(): FmeaRegister {
  return createRegister([
    seed('fm-cable-rupture', 'Main line', 'Cable rupture', 'Uncontrolled load release', 10, 2, 4),
    seed('fm-splice', 'Main line', 'Splice/termination failure', 'Loss of line tension', 10, 2, 5),
    seed('fm-shackle', 'Rigging', 'Shackle failure', 'Rigging disconnect', 9, 2, 4),
    seed('fm-master-ring', 'Rigging', 'Master-ring failure', 'Total support loss', 10, 1, 4),
    seed('fm-anchor-slide', 'Anchors', 'Anchor sliding', 'Geometry change, load shift', 7, 3, 3),
    seed('fm-anchor-uplift', 'Anchors', 'Anchor uplift', 'Loss of restraint', 8, 2, 4),
    seed('fm-crane-overload', 'Crane', 'Crane overload', 'Structural failure / drop', 10, 2, 3),
    seed('fm-crane-sideload', 'Crane', 'Crane side load', 'Boom instability', 9, 3, 4),
    seed('fm-derail', 'Trolley', 'Trolley derailment', 'Loss of guidance', 8, 3, 4),
    seed('fm-wheel-seize', 'Trolley', 'Wheel bearing seizure', 'Uncontrolled deceleration', 7, 3, 5),
    seed('fm-overspeed', 'Trolley', 'Overspeed', 'Excess brake-entry energy', 8, 4, 4),
    seed('fm-payload-collide', 'Payload', 'Payload collision', 'Article damage / hazard', 8, 3, 5),
    seed('fm-sway', 'Payload', 'Excessive sway', 'Corridor intrusion', 6, 4, 4),
    seed('fm-brake-fail', 'Brake', 'Primary brake failure', 'No controlled stop', 10, 2, 4),
    seed('fm-brake-overheat', 'Brake', 'Brake overheating/fade', 'Reduced stopping force', 8, 3, 6),
    seed('fm-arrestor', 'Brake', 'Backup arrestor failure', 'No fallback stop', 10, 1, 5),
    seed('fm-release', 'Controls', 'Unexpected release', 'Premature launch', 9, 2, 4),
    seed('fm-winch-runaway', 'Recovery', 'Winch runaway', 'Uncontrolled motion', 8, 2, 4),
    seed('fm-power-loss', 'Controls', 'Loss of electrical power', 'Loss of monitoring', 6, 3, 3),
    seed('fm-sensor', 'Instrumentation', 'Sensor failure', 'Loss of data / interlock', 6, 4, 4),
    seed('fm-calibration', 'Instrumentation', 'Incorrect calibration', 'Wrong load reading', 7, 3, 6),
    seed('fm-bad-hardware-data', 'Data', 'Invalid hardware data used', 'Undersized component', 9, 3, 5),
    seed('fm-nonconvergence', 'Analysis', 'Solver non-convergence', 'Unreliable result', 6, 3, 2),
    seed('fm-wind', 'Environment', 'Excessive wind', 'Overload / instability', 8, 3, 3),
    seed('fm-zone-intrusion', 'Safety', 'Operator-zone intrusion', 'Personnel exposure', 10, 2, 3),
  ]);
}
