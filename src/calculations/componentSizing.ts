/**
 * Component sizing and candidate selection — Milestone 13.
 *
 * Maps a calculated demand to a required rating (via design factor and
 * deratings) and matches it against the component library. It ranks candidates
 * but never auto-selects the smallest passing part: every candidate is returned
 * with its utilization, controlling criterion, verification status, and the
 * reason it passed or failed.
 *
 * Governance:
 *  - The published rating and the derated rating are reported separately from
 *    the demand (Rule 5).
 *  - Obsolete and unverified parts are excluded when verified data is required,
 *    and the exclusion reason is recorded (Rule 4).
 *  - Missing ratings are never treated as adequate (Rule 3): a candidate whose
 *    rating property is missing is reported as insufficient information.
 */

import type { ComponentCategory } from '../core/model';
import { isMissing } from '../core/provenance';
import {
  findProperty,
  isRecordVerified,
  recordVerificationState,
  type ComponentLibrary,
  type ComponentRecord,
} from '../core/library/componentLibrary';

export interface SizingDemand {
  /** What is being sized, e.g. 'Main line MBS', 'Brake anchor lateral'. */
  label: string;
  category: ComponentCategory;
  /** Property key whose value is the component's rating, e.g. 'minimumBreakingStrength'. */
  ratingKey: string;
  /** Calculated peak demand, SI (e.g. N). */
  demand: number;
  /** Design factor applied to the demand (rating ≥ demand × designFactor). */
  designFactor: number;
  /**
   * Deratings applied to the PUBLISHED rating before comparison, each < 1.
   * derated rating = published × Π(derating). e.g. { temperature: 0.9 }.
   */
  deratings?: Record<string, number>;
  /** When true, obsolete/unverified candidates are excluded. */
  requireVerified?: boolean;
}

export type CandidateStatus =
  | 'pass'
  | 'fail'
  | 'insufficientInformation'
  | 'excludedUnverified'
  | 'excludedObsolete';

export interface Candidate {
  recordId: string;
  name: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  /** Published rating from the library, SI (null when the property is missing). */
  publishedRating: number | null;
  /** Rating after project deratings, SI (null when missing). */
  deratedRating: number | null;
  /** Required rating = demand × designFactor, SI. */
  requiredRating: number;
  /** deratedRating / requiredRating (utilization is its inverse). */
  margin: number | null;
  /** requiredRating / deratedRating (fraction of the derated rating used). */
  utilization: number | null;
  verificationState: string;
  status: CandidateStatus;
  /** The criterion that governed the outcome. */
  controllingCriterion: string;
  reason: string;
}

export interface SizingResult {
  demandLabel: string;
  category: ComponentCategory;
  requiredRating: number;
  /** Candidates that pass, ranked best margin first. */
  passing: Candidate[];
  /** All evaluated candidates (pass, fail, excluded), for transparency. */
  allCandidates: Candidate[];
  /** True when at least one passing candidate exists. */
  anyPass: boolean;
  warnings: string[];
}

/** Product of the derating factors (defaults to 1). */
function deratingProduct(deratings?: Record<string, number>): { factor: number; warnings: string[] } {
  const warnings: string[] = [];
  let factor = 1;
  for (const [k, v] of Object.entries(deratings ?? {})) {
    if (!(v > 0) || v > 1) warnings.push(`Derating "${k}" = ${v} should be in (0, 1].`);
    factor *= v;
  }
  return { factor, warnings };
}

export function sizeComponent(lib: ComponentLibrary, demand: SizingDemand): SizingResult {
  const warnings: string[] = [];
  if (!(demand.demand >= 0)) {
    warnings.push('Demand must be ≥ 0; sizing cannot proceed.');
  }
  if (!(demand.designFactor >= 1)) {
    warnings.push(`Design factor ${demand.designFactor} is below 1; verify the project criteria.`);
  }
  const requiredRating = demand.demand * demand.designFactor;
  const { factor: deratingFactor, warnings: dWarn } = deratingProduct(demand.deratings);
  warnings.push(...dWarn);

  const records = lib.records.filter((r) => r.category === demand.category);
  const all: Candidate[] = records.map((r) =>
    evaluateCandidate(r, demand, requiredRating, deratingFactor),
  );

  const passing = all
    .filter((c) => c.status === 'pass')
    .sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));

  if (records.length === 0) {
    warnings.push(`No components in category "${demand.category}"; a procurement search is needed.`);
  } else if (passing.length === 0) {
    warnings.push(
      `No passing candidate for "${demand.label}" (required ${requiredRating.toFixed(0)} SI). ` +
        'Enter a suitable component or run a procurement search.',
    );
  }

  return {
    demandLabel: demand.label,
    category: demand.category,
    requiredRating,
    passing,
    allCandidates: all,
    anyPass: passing.length > 0,
    warnings,
  };
}

function evaluateCandidate(
  record: ComponentRecord,
  demand: SizingDemand,
  requiredRating: number,
  deratingFactor: number,
): Candidate {
  const base = {
    recordId: record.id,
    name: record.name,
    manufacturer: record.manufacturer,
    model: record.model,
    partNumber: record.partNumber,
    requiredRating,
    verificationState: recordVerificationState(record),
  };

  // Exclusions first (Rule 4).
  if (record.obsolete) {
    return {
      ...base, publishedRating: null, deratedRating: null, margin: null, utilization: null,
      status: 'excludedObsolete', controllingCriterion: 'obsolescence',
      reason: 'Component is obsolete and excluded from selection.',
    };
  }
  if (demand.requireVerified && !isRecordVerified(record)) {
    return {
      ...base, publishedRating: null, deratedRating: null, margin: null, utilization: null,
      status: 'excludedUnverified', controllingCriterion: 'verification',
      reason: `Verified data required, but this record is ${recordVerificationState(record)}.`,
    };
  }

  const prop = findProperty(record, demand.ratingKey);
  if (!prop || isMissing(prop.quantity)) {
    return {
      ...base, publishedRating: null, deratedRating: null, margin: null, utilization: null,
      status: 'insufficientInformation', controllingCriterion: demand.ratingKey,
      reason: `Rating property "${demand.ratingKey}" is not entered; cannot evaluate (never assumed).`,
    };
  }

  const published = prop.quantity.value as number;
  const derated = published * deratingFactor;
  const margin = requiredRating > 0 ? derated / requiredRating : Infinity;
  const utilization = derated > 0 ? requiredRating / derated : Infinity;
  const pass = derated >= requiredRating;

  return {
    ...base,
    publishedRating: published,
    deratedRating: derated,
    margin,
    utilization,
    status: pass ? 'pass' : 'fail',
    controllingCriterion: demand.ratingKey,
    reason: pass
      ? `Derated rating ${derated.toFixed(0)} ≥ required ${requiredRating.toFixed(0)} (margin ${margin.toFixed(2)}×).`
      : `Derated rating ${derated.toFixed(0)} < required ${requiredRating.toFixed(0)} (short by ${(requiredRating - derated).toFixed(0)}).`,
  };
}

// ── bill of materials from sizing ──────────────────────────────────────────

export interface SizedBomLine {
  itemNumber: string;
  label: string;
  category: ComponentCategory;
  requiredRating: number;
  /** The selected candidate, or null when none passed (procurement needed). */
  selected: Candidate | null;
  /** 'selected' | 'recommendedMinimum' | 'procurementRequired'. */
  disposition: 'selected' | 'procurementRequired';
}

/**
 * Assembles BOM lines from a set of sizing results. A demand with no passing
 * candidate becomes a `procurementRequired` line rather than a fabricated part
 * (missing information is never dressed up as a selection).
 */
export function assembleBom(results: SizingResult[]): SizedBomLine[] {
  return results.map((r, i) => {
    const selected = r.passing[0] ?? null;
    return {
      itemNumber: String(i + 1).padStart(3, '0'),
      label: r.demandLabel,
      category: r.category,
      requiredRating: r.requiredRating,
      selected,
      disposition: selected ? 'selected' : 'procurementRequired',
    };
  });
}
