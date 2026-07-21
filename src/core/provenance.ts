/**
 * Data provenance and dimensional quantities — Milestone 6.
 *
 * Every engineering property carries a value AND the story of where it came
 * from. Governance rules enforced structurally here:
 *
 *   Rule 3 — A missing value is NEVER silently replaced with zero. `value:
 *            null` with state `'missing'` is first-class and propagates.
 *   Rule 4 — Example / estimated / imported-unverified data can never be read
 *            as verified; `isVerified()` is the only gate.
 *   Rule 5 — The original published value is preserved in `sourceValue`,
 *            separately from any engineering derating applied to `value`.
 *   Rule 6 — Units and dimension travel with the value.
 *
 * The full component-library provenance (attachments, page citations, duty
 * cycles) is Milestone 7; the fields here are its forward-compatible core.
 */

import { SI_UNIT, type Dimension } from './dimensions';

/**
 * Verification state of an engineering property.
 *
 *  manufacturerVerified — confirmed against the manufacturer's current document
 *  userVerified         — confirmed by the user against a cited source
 *  internallyTested     — measured by the organization's own test
 *  supplierListed       — from a distributor/supplier summary, not the maker
 *  provisional          — working value chosen by the engineer, pending check
 *  estimated            — derived or inferred (geometry, correlation)
 *  exampleOnly          — illustrative placeholder shipped with the software
 *  importedUnverified   — pulled from an online/imported source, unchecked
 *  obsolete             — superseded; retained for history, not for design
 *  missing              — not supplied; dependent checks report insufficient info
 */
export type VerificationState =
  | 'manufacturerVerified'
  | 'userVerified'
  | 'internallyTested'
  | 'supplierListed'
  | 'provisional'
  | 'estimated'
  | 'exampleOnly'
  | 'importedUnverified'
  | 'obsolete'
  | 'missing';

/** Ranked worst → best, used for aggregation. */
const STATE_RANK: Record<VerificationState, number> = {
  missing: 0,
  obsolete: 1,
  exampleOnly: 2,
  importedUnverified: 3,
  estimated: 4,
  provisional: 5,
  supplierListed: 6,
  internallyTested: 7,
  userVerified: 8,
  manufacturerVerified: 9,
};

/**
 * The only states that count as verified for design decisions.
 * A supplier listing is deliberately NOT verified (Rule 12: distributor
 * summaries and search results are not engineering proof).
 */
const VERIFIED_STATES: ReadonlySet<VerificationState> = new Set<VerificationState>([
  'manufacturerVerified',
  'userVerified',
  'internallyTested',
]);

export function isVerified(state: VerificationState): boolean {
  return VERIFIED_STATES.has(state);
}

export type Confidence = 'low' | 'medium' | 'high';

/** Where a value came from and how much it can be trusted. */
export interface Provenance {
  state: VerificationState;
  /** Kind of source: 'manufacturerDocument', 'test', 'calculation', … */
  sourceType?: string;
  /** Document title or description. */
  sourceDocument?: string;
  /** URL, when retrieved online. Preserved with `retrievedOn` (Rule 12). */
  sourceUrl?: string;
  /** Page, table, or section supporting the value. */
  sourceLocation?: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  /** Document revision. */
  revision?: string;
  /** ISO-8601 publication date of the source document. */
  publishedOn?: string;
  /** ISO-8601 date the value was retrieved (online sources). */
  retrievedOn?: string;
  enteredBy?: string;
  verifiedBy?: string;
  /** ISO-8601 date of verification. */
  verifiedOn?: string;
  confidence?: Confidence;
  /** Human description of the derating applied, e.g. "0.8 for side loading". */
  deratingRule?: string;
  /** Factor applied to `sourceValue` to obtain `value`. */
  deratingFactor?: number;
  notes?: string;
}

/**
 * A physical quantity in SI, tagged with its dimension and provenance.
 *
 * `value` is the working (possibly derated) value solvers consume.
 * `sourceValue` is the original published figure, preserved separately (Rule 5).
 * `value === null` means MISSING — never treat it as 0.
 */
export interface Quantity<D extends Dimension = Dimension> {
  value: number | null;
  dimension: D;
  /** SI unit label, derived from the dimension. */
  unit: string;
  /** Original value before derating, SI. Absent when no derating was applied. */
  sourceValue?: number | null;
  provenance: Provenance;
}

// ── constructors ─────────────────────────────────────────────────────────

export function quantity<D extends Dimension>(
  value: number,
  dimension: D,
  state: VerificationState,
  extra: Omit<Provenance, 'state'> = {},
): Quantity<D> {
  return { value, dimension, unit: SI_UNIT[dimension], provenance: { state, ...extra } };
}

/** An explicitly missing quantity. Dependent checks must report insufficient info. */
export function missing<D extends Dimension>(dimension: D, notes?: string): Quantity<D> {
  return {
    value: null,
    dimension,
    unit: SI_UNIT[dimension],
    provenance: { state: 'missing', notes },
  };
}

/** Illustrative placeholder shipped with the software — never test-authorizing. */
export function exampleValue<D extends Dimension>(
  value: number,
  dimension: D,
  notes?: string,
): Quantity<D> {
  return quantity(value, dimension, 'exampleOnly', { notes });
}

export function provisional<D extends Dimension>(
  value: number,
  dimension: D,
  notes?: string,
): Quantity<D> {
  return quantity(value, dimension, 'provisional', { notes });
}

export function estimated<D extends Dimension>(
  value: number,
  dimension: D,
  notes?: string,
): Quantity<D> {
  return quantity(value, dimension, 'estimated', { notes });
}

/**
 * Applies a derating factor, preserving the original source value (Rule 5).
 * The returned quantity keeps the source provenance and records the rule.
 */
export function derate<D extends Dimension>(
  q: Quantity<D>,
  factor: number,
  rule: string,
): Quantity<D> {
  if (!(factor > 0) || !Number.isFinite(factor)) {
    throw new Error(`Derating factor must be a positive finite number (got ${factor}).`);
  }
  const original = q.sourceValue ?? q.value;
  return {
    ...q,
    value: q.value === null ? null : q.value * factor,
    sourceValue: original,
    provenance: { ...q.provenance, deratingFactor: factor, deratingRule: rule },
  };
}

// ── accessors ────────────────────────────────────────────────────────────

export function isMissing(q: Quantity | undefined | null): boolean {
  return !q || q.value === null || q.provenance.state === 'missing';
}

/**
 * Reads a quantity a calculation requires. Returns null when missing —
 * callers MUST branch and report "insufficient information" rather than
 * substituting a value (Rule 3).
 */
export function valueOrNull(q: Quantity | undefined | null): number | null {
  if (isMissing(q)) return null;
  return (q as Quantity).value;
}

/**
 * Reads a required quantity, throwing when missing. Use only where presence
 * has already been established; prefer `valueOrNull` plus an explicit
 * insufficient-information result.
 */
export function requireValue(q: Quantity | undefined | null, label: string): number {
  const v = valueOrNull(q);
  if (v === null) {
    throw new Error(
      `Required quantity "${label}" is missing. It must be supplied by the user — ` +
        'it is never defaulted (governance Rule 3).',
    );
  }
  return v;
}

/** Worst (least trustworthy) state across the given quantities. */
export function worstState(quantities: (Quantity | undefined | null)[]): VerificationState {
  let worst: VerificationState = 'manufacturerVerified';
  for (const q of quantities) {
    const s: VerificationState = !q ? 'missing' : q.provenance.state;
    if (STATE_RANK[s] < STATE_RANK[worst]) worst = s;
  }
  return worst;
}

/**
 * True only when every quantity is present AND verified. Anything else
 * requires engineering review before it can support a physical test.
 */
export function allVerified(quantities: (Quantity | undefined | null)[]): boolean {
  return quantities.every((q) => !!q && !isMissing(q) && isVerified(q.provenance.state));
}

/** Mixed-confidence summary for the result badge (Rule 6). */
export type InputConfidence = 'verified' | 'mixed' | 'unverified' | 'insufficient';

export function summarizeConfidence(quantities: (Quantity | undefined | null)[]): InputConfidence {
  if (quantities.length === 0) return 'insufficient';
  if (quantities.some((q) => isMissing(q))) return 'insufficient';
  if (allVerified(quantities)) return 'verified';
  const anyVerified = quantities.some((q) => !!q && isVerified(q.provenance.state));
  return anyVerified ? 'mixed' : 'unverified';
}

/** Human-readable labels for UI and reports. */
export const STATE_LABEL: Record<VerificationState, string> = {
  manufacturerVerified: 'Manufacturer verified',
  userVerified: 'User verified',
  internallyTested: 'Internally tested',
  supplierListed: 'Supplier listed (unverified)',
  provisional: 'Provisional',
  estimated: 'Estimated',
  exampleOnly: 'EXAMPLE ONLY — not for use',
  importedUnverified: 'Imported — UNVERIFIED',
  obsolete: 'OBSOLETE — superseded',
  missing: 'NOT ENTERED',
};
