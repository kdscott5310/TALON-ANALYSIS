/**
 * Procurement search sheet — Milestone 13.
 *
 * When no exact component has been selected, TALON emits a search sheet: the
 * calculated requirement, useful search phrases, and a supplier-inquiry / RFQ
 * text. The output clearly distinguishes the calculated requirement, the
 * recommended minimum, and any selected/verified component so a reader never
 * mistakes a requirement for a chosen part.
 */

import type { ComponentCategory } from '../core/model';
import type { SizingResult } from '../calculations/componentSizing';

export interface SearchSpec {
  category: ComponentCategory;
  /** Human requirement label. */
  requirementLabel: string;
  /** Required rating (SI) and a US-ish display hint. */
  requiredRatingSI: number;
  ratingKey: string;
  /** Extra qualifiers to include in the search, e.g. environment, size. */
  qualifiers?: string[];
}

/** Short, human category names for search phrasing. */
const CATEGORY_PHRASE: Partial<Record<ComponentCategory, string>> = {
  wireRope: 'wire rope',
  syntheticRope: 'HMPE synthetic rope',
  shackle: 'rated bow shackle',
  masterLink: 'master link',
  snatchBlock: 'rated swivel snatch block',
  sheave: 'cable sheave',
  loadCell: 'tension load cell',
  shockAbsorber: 'industrial hydraulic shock absorber',
  hydraulicCylinder: 'hydraulic cylinder',
  turnbuckle: 'jaw-and-jaw turnbuckle',
  groundAnchor: 'engineered ground anchor',
  ecologyBlock: 'concrete ecology block ballast',
  crane: 'mobile crane',
};

const RATING_PHRASE: Record<string, (n: number) => string> = {
  minimumBreakingStrength: (n) => `minimum breaking strength ${Math.ceil(n)} N`,
  workingLoadLimit: (n) => `working load limit ${Math.ceil(n)} N`,
  ratedCapacity: (n) => `rated capacity ${Math.ceil(n)} N`,
  energyCapacity: (n) => `energy capacity ${Math.ceil(n)} J`,
  forceCapacity: (n) => `force capacity ${Math.ceil(n)} N`,
};

/** Builds a human search phrase such as manufacturers/distributors respond to. */
export function buildSearchPhrase(spec: SearchSpec): string {
  const cat = CATEGORY_PHRASE[spec.category] ?? spec.category;
  const rating = (RATING_PHRASE[spec.ratingKey] ?? ((n: number) => `rating ${Math.ceil(n)} SI`))(
    spec.requiredRatingSI,
  );
  const quals = (spec.qualifiers ?? []).join(' ');
  return [cat, rating, quals, 'manufacturer load chart datasheet']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ProcurementSheet {
  generatedAt: string;
  lines: ProcurementLine[];
  disclaimer: string;
}

export interface ProcurementLine {
  requirementLabel: string;
  category: ComponentCategory;
  /** The calculated requirement — clearly labeled as a requirement, not a part. */
  calculatedRequirementSI: number;
  /** Recommended minimum = the calculated requirement (with any margin folded in upstream). */
  recommendedMinimumSI: number;
  /** A selected component when one passed sizing, else null (procurement needed). */
  selected: { name: string; partNumber?: string; verified: boolean } | null;
  searchPhrase: string;
  rfqText: string;
}

const DISCLAIMER =
  'This is a procurement search aid, not a specification or an endorsement. ' +
  'Calculated requirements are preliminary; verify every rating against the ' +
  'current manufacturer document before purchase or use.';

/** Generates a procurement sheet from sizing results. */
export function buildProcurementSheet(
  results: SizingResult[],
  ratingKeyByLabel: Record<string, string>,
  generatedAt = new Date().toISOString(),
): ProcurementSheet {
  const lines: ProcurementLine[] = results.map((r) => {
    const ratingKey = ratingKeyByLabel[r.demandLabel] ?? 'ratedCapacity';
    const spec: SearchSpec = {
      category: r.category,
      requirementLabel: r.demandLabel,
      requiredRatingSI: r.requiredRating,
      ratingKey,
    };
    const best = r.passing[0] ?? null;
    const searchPhrase = buildSearchPhrase(spec);
    return {
      requirementLabel: r.demandLabel,
      category: r.category,
      calculatedRequirementSI: r.requiredRating,
      recommendedMinimumSI: r.requiredRating,
      selected: best
        ? {
            name: best.name,
            partNumber: best.partNumber,
            verified: /verified|tested/i.test(best.verificationState),
          }
        : null,
      searchPhrase,
      rfqText:
        `RFQ — ${r.demandLabel}: seeking a ${CATEGORY_PHRASE[r.category] ?? r.category} with a ` +
        `minimum ${ratingKey} of ${Math.ceil(r.requiredRating)} SI units. ` +
        'Please provide the manufacturer datasheet, load chart, certification, ' +
        'material, mass, dimensions, lead time, and unit price.',
    };
  });

  return { generatedAt, lines, disclaimer: DISCLAIMER };
}

/** Renders the sheet to CSV. Missing selections export as "PROCUREMENT REQUIRED", never blank-as-ok. */
export function procurementSheetCsv(sheet: ProcurementSheet): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [
    'requirement,category,calculated_requirement_SI,recommended_minimum_SI,selected,verified,search_phrase',
  ];
  for (const l of sheet.lines) {
    rows.push(
      [
        esc(l.requirementLabel),
        esc(l.category),
        String(l.calculatedRequirementSI),
        String(l.recommendedMinimumSI),
        esc(l.selected ? (l.selected.partNumber ?? l.selected.name) : 'PROCUREMENT REQUIRED'),
        l.selected ? String(l.selected.verified) : 'n/a',
        esc(l.searchPhrase),
      ].join(','),
    );
  }
  rows.push('');
  rows.push(esc('DISCLAIMER: ' + sheet.disclaimer));
  return rows.join('\n');
}
