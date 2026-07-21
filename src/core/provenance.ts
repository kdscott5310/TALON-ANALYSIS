/**
 * Data provenance and quantities — Milestone 6.
 *
 * Every engineering property in the generalized model carries a value AND
 * the story of where that value came from. Two platform rules are enforced
 * structurally here:
 *
 *   Rule 2 — A missing rating is NEVER silently substituted with zero or an
 *            assumed safe value. `value: null` + state `'missing'` is a
 *            first-class state that propagates into results.
 *   Rule 3 — Verified, provisional, estimated, example, and missing data are
 *            distinguishable at every point of use.
 *
 * All values are SI. The `unit` field documents which SI unit, so results and
 * exports can state units without guessing (Rule 4).
 */

/**
 * How much trust a value carries.
 *
 *  verified    — confirmed against a manufacturer certificate, test report,
 *                standard, or field measurement, with a cited source.
 *  provisional — a working value chosen by the engineer, pending verification.
 *  estimated   — derived/inferred (e.g. from geometry or a correlation).
 *  example     — illustrative placeholder shipped with the app or a template.
 *                NEVER acceptable as a basis for a physical test.
 *  missing     — not supplied. Dependent checks report "insufficient
 *                information"; they must not pass, fail, or assume a value.
 */
export type VerificationState = 'verified' | 'provisional' | 'estimated' | 'example' | 'missing';

/** Ranked worst → best for aggregation. */
const STATE_RANK: Record<VerificationState, number> = {
  missing: 0,
  example: 1,
  estimated: 2,
  provisional: 3,
  verified: 4,
};

export type Confidence = 'low' | 'medium' | 'high';

export interface Provenance {
  state: VerificationState;
  /** Where the value came from: manufacturer cert, standard, test report, … */
  source?: string;
  /** Document/model identifier and revision, e.g. "AcmeRope DS-12 rev C". */
  reference?: string;
  /** ISO-8601 date the value was recorded or verified. */
  recordedOn?: string;
  verifiedBy?: string;
  confidence?: Confidence;
  /** Derating already applied to `value`, as a fraction (0.8 = 80% of rated). */
  deratingFactor?: number;
  notes?: string;
}

/** SI unit tags used by the model. Display conversion happens at the UI edge. */
export type SiUnit =
  | 'm'
  | 'm^2'
  | 'm^3'
  | 'kg'
  | 'kg/m'
  | 'kg/m^3'
  | 'kg*m^2'
  | 'N'
  | 'N/m'
  | 'N*s/m'
  | 'N*m'
  | 'Pa'
  | 's'
  | 'm/s'
  | 'm/s^2'
  | 'rad'
  | 'K'
  | 'degC'
  | '1/K'
  | 'J'
  | 'W'
  | '1'; // dimensionless

/**
 * A physical quantity in SI with provenance.
 * `value === null` means MISSING — never treat it as 0.
 */
export interface Quantity {
  value: number | null;
  unit: SiUnit;
  provenance: Provenance;
}

// ── constructors ─────────────────────────────────────────────────────────

export function quantity(
  value: number,
  unit: SiUnit,
  state: VerificationState,
  extra: Omit<Provenance, 'state'> = {},
): Quantity {
  return { value, unit, provenance: { state, ...extra } };
}

/** An explicitly missing quantity. Dependent checks must report insufficient info. */
export function missing(unit: SiUnit, notes?: string): Quantity {
  return { value: null, unit, provenance: { state: 'missing', notes } };
}

/** Illustrative placeholder shipped with a template — never test-authorizing. */
export function exampleValue(value: number, unit: SiUnit, notes?: string): Quantity {
  return { value, unit, provenance: { state: 'example', notes } };
}

export function provisional(value: number, unit: SiUnit, notes?: string): Quantity {
  return { value, unit, provenance: { state: 'provisional', notes } };
}

export function estimated(value: number, unit: SiUnit, notes?: string): Quantity {
  return { value, unit, provenance: { state: 'estimated', notes } };
}

// ── accessors ────────────────────────────────────────────────────────────

export function isMissing(q: Quantity | undefined | null): boolean {
  return !q || q.value === null || q.provenance.state === 'missing';
}

/**
 * Reads a quantity that a calculation requires.
 * Returns null when missing — callers MUST branch on null and report
 * "insufficient information" rather than substituting a value (Rule 2).
 */
export function valueOrNull(q: Quantity | undefined | null): number | null {
  if (isMissing(q)) return null;
  return (q as Quantity).value;
}

/**
 * Reads a required quantity, throwing when missing.
 * Use only where the caller has already verified presence; prefer
 * `valueOrNull` and an explicit insufficient-information result.
 */
export function requireValue(q: Quantity | undefined | null, label: string): number {
  const v = valueOrNull(q);
  if (v === null) {
    throw new Error(
      `Required quantity "${label}" is missing. It must be supplied by the user — ` +
        'it is never defaulted (platform Rule 2).',
    );
  }
  return v;
}

/** Worst (least trustworthy) state across the given quantities. */
export function worstState(quantities: (Quantity | undefined | null)[]): VerificationState {
  let worst: VerificationState = 'verified';
  for (const q of quantities) {
    const s: VerificationState = !q ? 'missing' : q.provenance.state;
    if (STATE_RANK[s] < STATE_RANK[worst]) worst = s;
  }
  return worst;
}

/**
 * True when a set of quantities is fit to support a physical test decision:
 * every value present and verified. Everything else requires review.
 */
export function isTestAuthorizing(quantities: (Quantity | undefined | null)[]): boolean {
  return worstState(quantities) === 'verified';
}

/** Human-readable state label for UI and reports. */
export const STATE_LABEL: Record<VerificationState, string> = {
  verified: 'Verified',
  provisional: 'Provisional',
  estimated: 'Estimated',
  example: 'EXAMPLE — not for use',
  missing: 'NOT ENTERED',
};
