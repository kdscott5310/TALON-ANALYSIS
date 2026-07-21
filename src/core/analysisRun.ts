/**
 * Immutable analysis runs — Milestone 6.
 *
 * A completed analysis run is a frozen historical record. A report issued
 * months ago must remain reproducible and readable after later software
 * changes, so a run captures everything needed to explain and re-create it:
 * revisions, solver version, source commit, library revision, the full input
 * snapshot, settings, units, coordinate systems, results, warnings,
 * applicability, convergence, validation status, and risks.
 *
 * Immutability is enforced with a deep freeze plus a content fingerprint;
 * `verifyRunIntegrity` detects any post-hoc edit.
 */

import type { Scenario } from '../models/scenario';
import type { CoordinateSystem } from './coordinates';
import type { SolverOutput } from './solver';
import type { VerificationState } from './provenance';

/** Everything identifying *what software* produced a run. */
export interface RunProvenance {
  /** Project revision at run time. */
  projectRevision: string;
  /** Fixture template id and version. */
  fixtureTemplateId: string;
  fixtureTemplateVersion: number;
  /** Scenario/template-data revision. */
  scenarioRevision: number;
  /** Project schema version. */
  modelSchemaVersion: number;
  solverId: string;
  solverVersion: string;
  /** Source-code commit, when the build injects it. `null` when unknown — the
   *  field is never fabricated (Rule 3). */
  sourceCommit: string | null;
  /** Component-library revision, or null before the library exists (M7). */
  componentLibraryRevision: string | null;
  appVersion: string;
}

/** A frozen record of one completed analysis. */
export interface AnalysisRun {
  id: string;
  /** ISO-8601 timestamp. */
  ranOn: string;
  author: string;
  analysisCaseId: string;
  provenance: RunProvenance;
  /** Deep copy of the inputs exactly as solved. */
  inputSnapshot: {
    scenario?: Scenario;
    settings: Record<string, number | string | boolean>;
  };
  /** Coordinate systems in force for this run. */
  coordinateSystems: readonly CoordinateSystem[];
  /** Unit convention: always SI internally (Rule 8). */
  unitSystem: 'SI';
  output: SolverOutput;
  /** Ids of risks open at run time (M14). */
  openRiskIds: readonly string[];
  /** Worst input verification state at run time. */
  inputVerification: VerificationState;
  /** Report revision this run backs, when a report was issued. */
  reportRevision?: string;
  /** Content fingerprint used to detect tampering. */
  fingerprint: string;
}

/** Recursively freezes an object graph. */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.getOwnPropertyNames(obj).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) deepFreeze(value);
  });
  return Object.freeze(obj);
}

/**
 * Stable, order-independent stringification so the fingerprint depends on
 * content rather than key insertion order (Rule 9 — reproducibility).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(',')}}`;
}

/**
 * FNV-1a 32-bit fingerprint, rendered as 8 hex characters.
 *
 * This is a change-detection checksum, NOT a cryptographic hash: it detects
 * accidental or casual modification of an archived run, and is not a defense
 * against a determined adversary.
 */
export function fingerprintContent(content: unknown): string {
  const text = stableStringify(content);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface CreateRunInput {
  id: string;
  author: string;
  analysisCaseId: string;
  provenance: RunProvenance;
  inputSnapshot: AnalysisRun['inputSnapshot'];
  coordinateSystems: readonly CoordinateSystem[];
  output: SolverOutput;
  openRiskIds?: readonly string[];
  inputVerification: VerificationState;
  reportRevision?: string;
  /** Injectable clock for deterministic tests. */
  ranOn?: string;
}

/**
 * Creates a frozen analysis run. The input snapshot is deep-copied first, so
 * later mutation of the caller's objects cannot alter the archived record.
 */
export function createAnalysisRun(input: CreateRunInput): AnalysisRun {
  const snapshot = JSON.parse(JSON.stringify(input.inputSnapshot)) as AnalysisRun['inputSnapshot'];
  const coordinateSystems = JSON.parse(
    JSON.stringify(input.coordinateSystems),
  ) as CoordinateSystem[];
  const output = JSON.parse(JSON.stringify(input.output)) as SolverOutput;

  const body = {
    id: input.id,
    ranOn: input.ranOn ?? new Date().toISOString(),
    author: input.author,
    analysisCaseId: input.analysisCaseId,
    provenance: input.provenance,
    inputSnapshot: snapshot,
    coordinateSystems,
    unitSystem: 'SI' as const,
    output,
    openRiskIds: input.openRiskIds ?? [],
    inputVerification: input.inputVerification,
    reportRevision: input.reportRevision,
  };

  const run: AnalysisRun = { ...body, fingerprint: fingerprintContent(body) };
  return deepFreeze(run);
}

/** Recomputes the fingerprint and compares it with the stored one. */
export function verifyRunIntegrity(run: AnalysisRun): boolean {
  const { fingerprint, ...body } = run;
  return fingerprintContent(body) === fingerprint;
}

/**
 * Human summary of a run for report headers — states fidelity, solver,
 * applicability, and that nothing here is certified (Rules 1 and 6).
 */
export function describeRun(run: AnalysisRun): string[] {
  const b = run.output.badge;
  return [
    `Analysis level:       ${b.analysisLevel}`,
    `Solver:               ${b.solver} v${b.solverVersion}`,
    `Validation:           ${b.validation}`,
    `Input confidence:     ${b.inputConfidence}`,
    `Applicability:        ${b.applicability}`,
    `Result status:        ${b.acceptance}`,
    `Certification status: ${b.certificationStatus}`,
    `Run:                  ${run.id} (${run.ranOn}), fingerprint ${run.fingerprint}`,
    `Source commit:        ${run.provenance.sourceCommit ?? 'not recorded'}`,
  ];
}
