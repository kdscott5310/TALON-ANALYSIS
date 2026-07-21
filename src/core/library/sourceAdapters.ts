/**
 * Component data source adapters — Milestone 7 (architecture only).
 *
 * Defines how candidate component data may be pulled from external sources.
 * No adapter in this build performs network access: the contract, the trust
 * rules, and the guard rails land first so that when a real adapter is added
 * it cannot bypass them.
 *
 * Governance (Rule 12 and the online-retrieval rules):
 *  1. Online data is ALWAYS marked `importedUnverified`.
 *  2. The URL and retrieval date are preserved.
 *  3. Original text/reference is preserved where legally permitted.
 *  4. Search snippets are never engineering proof — snippet-sourced values are
 *     rejected outright by `ingestCandidate`.
 *  5. The user must verify critical ratings against the current manufacturer
 *     document; ingestion records what still needs verifying.
 *  6. A verified record is never overwritten by an unverified one (enforced by
 *     `mergeRecord`).
 *  7. Outdated, incomplete, conflicting, or ambiguous data is warned about.
 *  8. Source history is maintained.
 *  9. No scraping in violation of a site's terms or access controls — adapters
 *     must declare their compliance basis and are refused without one.
 * 10. Manufacturer documents are preferred over distributor summaries.
 */

import type { ComponentCategory } from '../model';
import type { Quantity, VerificationState } from '../provenance';
import type { ComponentProperty, ComponentRecord, SourceAttachment } from './componentLibrary';

/** Ranked most → least trustworthy. Manufacturer documents win (Rule 10). */
export type SourceKind =
  | 'manufacturerDocument'
  | 'manufacturerPage'
  | 'distributorCatalog'
  | 'industryDatabase'
  | 'internalLibrary'
  | 'userUpload'
  | 'supplierApi'
  | 'searchSnippet';

export const SOURCE_RANK: Record<SourceKind, number> = {
  manufacturerDocument: 0,
  manufacturerPage: 1,
  supplierApi: 2,
  industryDatabase: 3,
  internalLibrary: 4,
  userUpload: 5,
  distributorCatalog: 6,
  searchSnippet: 7,
};

/** Search snippets can never establish an engineering property. */
export const NON_EVIDENTIAL_SOURCES: ReadonlySet<SourceKind> = new Set<SourceKind>([
  'searchSnippet',
]);

/**
 * How an adapter is permitted to access its source. An adapter without a
 * declared basis is refused — TALON does not scrape by default.
 */
export interface ComplianceBasis {
  /** e.g. 'publicDocumentation', 'licensedApi', 'userSuppliedFile', 'writtenPermission'. */
  basis: string;
  /** True when the adapter honours robots.txt / documented API terms. */
  respectsSiteTerms: boolean;
  /** True when the adapter bypasses any authentication or access control. */
  bypassesAccessControls: boolean;
  notes?: string;
}

export interface SourceAdapterDescriptor {
  id: string;
  name: string;
  sourceKind: SourceKind;
  compliance: ComplianceBasis;
  /** False in this build: no adapter performs network access yet. */
  networkEnabled: boolean;
  description?: string;
}

/** A candidate component proposed by an adapter, before ingestion. */
export interface CandidateComponent {
  adapterId: string;
  sourceKind: SourceKind;
  category: ComponentCategory;
  name: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  /** Properties as published; values are SI. */
  properties: { key: string; label: string; quantity: Quantity }[];
  sourceUrl?: string;
  sourceDocument?: string;
  publishedOn?: string;
  retrievedOn: string;
  /** Verbatim source text, where retaining it is legally permitted. */
  originalText?: string;
  attachments?: SourceAttachment[];
}

export type IngestResult =
  | { ok: true; record: ComponentRecord; mustVerify: string[]; warnings: string[] }
  | { ok: false; errors: string[] };

/** Properties that always require manufacturer verification before design use. */
const CRITICAL_PROPERTY_KEYS = new Set([
  'workingLoadLimit',
  'minimumBreakingStrength',
  'ratedCapacity',
  'proofLoad',
  'energyCapacity',
  'forceCapacity',
  'axialStiffness',
]);

/**
 * Validates an adapter before it may contribute data. Refuses adapters that
 * bypass access controls or do not declare a compliance basis (Rule 9).
 */
export function validateAdapter(descriptor: SourceAdapterDescriptor): string[] {
  const errors: string[] = [];
  if (!descriptor.compliance.basis.trim()) {
    errors.push(`Adapter "${descriptor.id}" declares no compliance basis; refused.`);
  }
  if (descriptor.compliance.bypassesAccessControls) {
    errors.push(
      `Adapter "${descriptor.id}" bypasses access controls; refused. TALON does not ` +
        "access data behind authentication or against a site's terms.",
    );
  }
  if (!descriptor.compliance.respectsSiteTerms) {
    errors.push(`Adapter "${descriptor.id}" does not declare that it respects site terms; refused.`);
  }
  return errors;
}

/**
 * Converts a candidate into a library record under the trust rules.
 * Everything ingested is `importedUnverified`; nothing here can be verified.
 */
export function ingestCandidate(
  candidate: CandidateComponent,
  descriptor: SourceAdapterDescriptor,
): IngestResult {
  const adapterErrors = validateAdapter(descriptor);
  if (adapterErrors.length > 0) return { ok: false, errors: adapterErrors };

  if (NON_EVIDENTIAL_SOURCES.has(candidate.sourceKind)) {
    return {
      ok: false,
      errors: [
        'Search snippets are not engineering proof and cannot establish component ' +
          'properties. Attach the manufacturer document instead.',
      ],
    };
  }
  if (!candidate.retrievedOn) {
    return { ok: false, errors: ['Candidate has no retrieval date; refused (Rule 12).'] };
  }
  if (candidate.properties.length === 0) {
    return { ok: false, errors: ['Candidate carries no properties.'] };
  }

  const warnings: string[] = [];
  const mustVerify: string[] = [];

  if (candidate.sourceKind === 'distributorCatalog') {
    warnings.push(
      'Source is a distributor catalog. Prefer the manufacturer document; ' +
        'distributor summaries frequently omit derating and revision detail.',
    );
  }
  if (!candidate.publishedOn) {
    warnings.push('No publication date on the source; currency cannot be confirmed.');
  }
  if (!candidate.sourceUrl && !candidate.sourceDocument) {
    warnings.push('No source URL or document recorded; traceability is incomplete.');
  }

  const state: VerificationState = 'importedUnverified';
  const properties: ComponentProperty[] = candidate.properties.map((p) => {
    if (CRITICAL_PROPERTY_KEYS.has(p.key)) {
      mustVerify.push(
        `${p.label} (${p.key}) is a critical rating — verify against the current ` +
          'manufacturer document before design use.',
      );
    }
    return {
      key: p.key,
      label: p.label,
      quantity: {
        ...p.quantity,
        provenance: {
          ...p.quantity.provenance,
          state,
          sourceType: candidate.sourceKind,
          sourceDocument: candidate.sourceDocument,
          sourceUrl: candidate.sourceUrl,
          publishedOn: candidate.publishedOn,
          retrievedOn: candidate.retrievedOn,
          manufacturer: candidate.manufacturer,
          model: candidate.model,
          partNumber: candidate.partNumber,
          notes: 'Imported from an external source; unverified.',
        },
      },
    };
  });

  const record: ComponentRecord = {
    id: `imported-${candidate.adapterId}-${candidate.partNumber ?? candidate.name}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-'),
    category: candidate.category,
    name: candidate.name,
    manufacturer: candidate.manufacturer,
    model: candidate.model,
    partNumber: candidate.partNumber,
    properties,
    attachments: candidate.attachments ?? [],
    provenance: {
      state,
      sourceType: candidate.sourceKind,
      sourceDocument: candidate.sourceDocument,
      sourceUrl: candidate.sourceUrl,
      publishedOn: candidate.publishedOn,
      retrievedOn: candidate.retrievedOn,
      manufacturer: candidate.manufacturer,
      model: candidate.model,
      partNumber: candidate.partNumber,
      notes: candidate.originalText
        ? 'Original source text retained.'
        : 'Original source text not retained.',
    },
    obsolete: false,
    history: [
      {
        changedOn: candidate.retrievedOn,
        summary: `Imported from ${candidate.sourceKind} via adapter "${descriptor.id}".`,
        state,
      },
    ],
    notes: candidate.originalText,
  };

  return { ok: true, record, mustVerify, warnings };
}

/** Sorts candidates so manufacturer documents outrank distributor summaries. */
export function rankBySourceQuality(candidates: CandidateComponent[]): CandidateComponent[] {
  return [...candidates].sort((a, b) => SOURCE_RANK[a.sourceKind] - SOURCE_RANK[b.sourceKind]);
}

/**
 * The adapters shipped in this build. None performs network access; they exist
 * so the contract is testable and so a future adapter inherits the guard rails.
 */
export const BUILT_IN_ADAPTERS: readonly SourceAdapterDescriptor[] = [
  {
    id: 'user-upload',
    name: 'User-uploaded data sheet',
    sourceKind: 'userUpload',
    networkEnabled: false,
    compliance: {
      basis: 'userSuppliedFile',
      respectsSiteTerms: true,
      bypassesAccessControls: false,
      notes: 'The user supplies the document; TALON stores a reference and citations.',
    },
    description: 'Attach a PDF or data sheet and cite the page supporting each property.',
  },
  {
    id: 'internal-library',
    name: 'Organization-approved internal library',
    sourceKind: 'internalLibrary',
    networkEnabled: false,
    compliance: {
      basis: 'organizationApproved',
      respectsSiteTerms: true,
      bypassesAccessControls: false,
    },
    description: 'Import from a library curated and approved inside the organization.',
  },
];
