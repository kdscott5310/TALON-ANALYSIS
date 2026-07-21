/**
 * Milestone 7 — component library, provenance, import/export, adapters.
 *
 * Focus is the trust rules: seeds are never certified, imports are never
 * verified, verified records are never overwritten by unverified ones, and
 * missing values never become zero.
 */
import { describe, it, expect } from 'vitest';
import {
  auditLibrary,
  createLibrary,
  findProperty,
  findRecord,
  isRecordVerified,
  markObsolete,
  mergeRecord,
  recordVerificationState,
  selectRecords,
  type ComponentRecord,
} from '../core/library/componentLibrary';
import {
  exportLibraryCsv,
  exportLibraryJson,
  importLibraryCsv,
  importLibraryJson,
} from '../core/library/libraryIo';
import {
  BUILT_IN_ADAPTERS,
  ingestCandidate,
  rankBySourceQuality,
  validateAdapter,
  type CandidateComponent,
  type SourceAdapterDescriptor,
} from '../core/library/sourceAdapters';
import { buildSeedLibrary } from '../core/library/seedLibrary';
import { exampleValue, isVerified, quantity } from '../core/provenance';

function verifiedRecord(id = 'rec-1'): ComponentRecord {
  return {
    id,
    category: 'shackle',
    name: 'Verified shackle',
    manufacturer: 'Example Rigging Co',
    partNumber: 'ERC-1234',
    properties: [
      {
        key: 'workingLoadLimit',
        label: 'Working load limit',
        quantity: quantity(98000, 'force', 'manufacturerVerified', {
          sourceDocument: 'Catalog rev C',
          publishedOn: '2025-01-01',
        }),
      },
    ],
    attachments: [],
    provenance: { state: 'manufacturerVerified', publishedOn: '2025-01-01' },
    obsolete: false,
    history: [],
  };
}

function unverifiedRecord(id = 'rec-1'): ComponentRecord {
  return {
    ...verifiedRecord(id),
    name: 'Scraped shackle',
    properties: [
      {
        key: 'workingLoadLimit',
        label: 'Working load limit',
        quantity: quantity(120000, 'force', 'importedUnverified'),
      },
    ],
    provenance: { state: 'importedUnverified', retrievedOn: '2026-07-21' },
  };
}

describe('seeded example data (Rule 4)', () => {
  const lib = buildSeedLibrary('2026-01-01T00:00:00.000Z');

  it('ships example records', () => {
    expect(lib.records.length).toBeGreaterThanOrEqual(6);
  });

  it('no seeded record or property claims a verified state', () => {
    for (const r of lib.records) {
      expect(isVerified(r.provenance.state)).toBe(false);
      expect(r.provenance.state).toBe('exampleOnly');
      expect(isRecordVerified(r)).toBe(false);
      for (const p of r.properties) {
        expect(isVerified(p.quantity.provenance.state)).toBe(false);
      }
    }
  });

  it('no seed implies a real product (no manufacturer, model or part number)', () => {
    for (const r of lib.records) {
      expect(r.manufacturer).toBeUndefined();
      expect(r.model).toBeUndefined();
      expect(r.partNumber).toBeUndefined();
      expect(r.name).toMatch(/EXAMPLE/i);
    }
  });

  it('audits every seed as critical example-only content', () => {
    const warnings = auditLibrary(lib, '2026-07-21T00:00:00.000Z');
    const critical = warnings.filter((w) => w.severity === 'critical');
    expect(critical.length).toBe(lib.records.length);
    expect(critical[0].message).toMatch(/EXAMPLE ONLY/);
  });
});

describe('verified records are never overwritten by unverified data (Rule 12)', () => {
  it('refuses an unverified overwrite and explains why', () => {
    const start = mergeRecord(createLibrary('L', '2026-01-01T00:00:00.000Z'), verifiedRecord());
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const attempt = mergeRecord(start.library, unverifiedRecord());
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toMatch(/never overwritten by/i);
    // The stored value is untouched.
    const stored = findRecord(start.library, 'rec-1')!;
    expect(findProperty(stored, 'workingLoadLimit')!.quantity.value).toBe(98000);
  });

  it('allows a verified record to replace an unverified one', () => {
    const start = mergeRecord(createLibrary('L', '2026-01-01T00:00:00.000Z'), unverifiedRecord());
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const upgrade = mergeRecord(start.library, verifiedRecord());
    expect(upgrade.ok).toBe(true);
    if (!upgrade.ok) return;
    expect(isRecordVerified(findRecord(upgrade.library, 'rec-1')!)).toBe(true);
  });

  it('warns when an incoming document is older than the stored one', () => {
    const first = mergeRecord(createLibrary('L', '2026-01-01T00:00:00.000Z'), {
      ...unverifiedRecord(),
      provenance: { state: 'importedUnverified', publishedOn: '2025-06-01' },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const older = mergeRecord(first.library, {
      ...unverifiedRecord(),
      provenance: { state: 'importedUnverified', publishedOn: '2020-01-01' },
    });
    expect(older.ok).toBe(true);
    if (!older.ok) return;
    expect(older.notes.join(' ')).toMatch(/older than the stored one/i);
  });

  it('bumps the library revision and keeps source history', () => {
    const lib0 = createLibrary('L', '2026-01-01T00:00:00.000Z');
    const r1 = mergeRecord(lib0, verifiedRecord(), { summary: 'created' });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.library.revision).toBe('2');
    const r2 = mergeRecord(r1.library, verifiedRecord(), { summary: 'rev D update' });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.library.revision).toBe('3');
    expect(findRecord(r2.library, 'rec-1')!.history).toHaveLength(2);
  });
});

describe('selection and obsolescence', () => {
  it('excludes obsolete records and can require verified data', () => {
    const added = mergeRecord(createLibrary('L', '2026-01-01T00:00:00.000Z'), verifiedRecord());
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(selectRecords(added.library, 'shackle')).toHaveLength(1);
    expect(selectRecords(added.library, 'shackle', { requireVerified: true })).toHaveLength(1);

    const obsoleted = markObsolete(added.library, 'rec-1', 'superseded by rev D', '2026-07-21T00:00:00.000Z');
    expect(selectRecords(obsoleted, 'shackle')).toHaveLength(0);
    expect(selectRecords(obsoleted, 'shackle', { includeObsolete: true })).toHaveLength(1);
    expect(recordVerificationState(findRecord(obsoleted, 'rec-1')!)).toBe('obsolete');
  });

  it('example-only records are excluded when verified data is required', () => {
    const lib = buildSeedLibrary('2026-01-01T00:00:00.000Z');
    expect(selectRecords(lib, 'shackle').length).toBeGreaterThan(0);
    expect(selectRecords(lib, 'shackle', { requireVerified: true })).toHaveLength(0);
  });
});

describe('library import / export', () => {
  const lib = buildSeedLibrary('2026-01-01T00:00:00.000Z');

  it('JSON round-trips records and provenance', () => {
    const result = importLibraryJson(exportLibraryJson(lib, '1.2.0'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.library.records).toHaveLength(lib.records.length);
    expect(result.library.records[0].provenance.state).toBe('exampleOnly');
  });

  it('rejects malformed JSON and foreign files', () => {
    expect(importLibraryJson('{oops').ok).toBe(false);
    expect(importLibraryJson(JSON.stringify({ fileType: 'other' })).ok).toBe(false);
    const future = JSON.parse(exportLibraryJson(lib, '1.2.0'));
    future.library.schemaVersion = 99;
    const r = importLibraryJson(JSON.stringify(future));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/newer than this build/i);
  });

  it('CSV export writes one row per property with units', () => {
    const csv = exportLibraryCsv(lib);
    const lines = csv.split('\n');
    expect(lines[0]).toMatch(/^recordId,category,name/);
    const totalProps = lib.records.reduce((n, r) => n + r.properties.length, 0);
    expect(lines.length).toBe(totalProps + 1);
    expect(csv).toMatch(/exampleOnly/);
  });

  it('CSV import marks everything importedUnverified and says so (Rule 12)', () => {
    const csv = exportLibraryCsv(lib);
    const result = importLibraryCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notes.join(' ')).toMatch(/cannot assert verification/i);
    for (const r of result.library.records) {
      expect(r.provenance.state).toBe('importedUnverified');
      for (const p of r.properties) {
        expect(isVerified(p.quantity.provenance.state)).toBe(false);
      }
    }
  });

  it('CSV import treats an empty value as MISSING, never zero (Rule 3)', () => {
    const csv = [
      'recordId,category,name,propertyKey,propertyLabel,value,dimension',
      'r1,shackle,Test shackle,workingLoadLimit,WLL,,force',
    ].join('\n');
    const result = importLibraryCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = findProperty(result.library.records[0], 'workingLoadLimit')!;
    expect(p.quantity.value).toBeNull();
    expect(p.quantity.provenance.state).toBe('missing');
  });

  it('rejects CSV with missing columns, bad dimensions, or bad numbers', () => {
    expect(importLibraryCsv('recordId,name\nr1,x').ok).toBe(false);
    const badDim = [
      'recordId,category,name,propertyKey,propertyLabel,value,dimension',
      'r1,shackle,X,wll,WLL,100,bananas',
    ].join('\n');
    expect(importLibraryCsv(badDim).ok).toBe(false);
    const badNum = [
      'recordId,category,name,propertyKey,propertyLabel,value,dimension',
      'r1,shackle,X,wll,WLL,abc,force',
    ].join('\n');
    expect(importLibraryCsv(badNum).ok).toBe(false);
  });

  it('handles quoted CSV cells containing commas', () => {
    const csv = [
      'recordId,category,name,propertyKey,propertyLabel,value,dimension',
      '"r1",shackle,"Shackle, bow type",wll,"WLL, rated",100,force',
    ].join('\n');
    const result = importLibraryCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.library.records[0].name).toBe('Shackle, bow type');
  });
});

describe('source adapters (Rule 12 and online-retrieval rules)', () => {
  const goodAdapter: SourceAdapterDescriptor = {
    id: 'mfr-doc',
    name: 'Manufacturer document',
    sourceKind: 'manufacturerDocument',
    networkEnabled: false,
    compliance: { basis: 'publicDocumentation', respectsSiteTerms: true, bypassesAccessControls: false },
  };

  const candidate = (over: Partial<CandidateComponent> = {}): CandidateComponent => ({
    adapterId: 'mfr-doc',
    sourceKind: 'manufacturerDocument',
    category: 'shackle',
    name: 'Bow shackle 10 t',
    manufacturer: 'Example Rigging Co',
    partNumber: 'ERC-1234',
    properties: [
      {
        key: 'workingLoadLimit',
        label: 'Working load limit',
        quantity: exampleValue(98000, 'force'),
      },
    ],
    sourceUrl: 'https://example.com/catalog.pdf',
    publishedOn: '2025-01-01',
    retrievedOn: '2026-07-21',
    ...over,
  });

  it('ships no network-enabled adapter in this build', () => {
    expect(BUILT_IN_ADAPTERS.every((a) => a.networkEnabled === false)).toBe(true);
    for (const a of BUILT_IN_ADAPTERS) expect(validateAdapter(a)).toEqual([]);
  });

  it('refuses adapters that bypass access controls or ignore site terms (Rule 9)', () => {
    expect(
      validateAdapter({
        ...goodAdapter,
        id: 'scraper',
        compliance: { basis: 'scrape', respectsSiteTerms: false, bypassesAccessControls: true },
      }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(validateAdapter({ ...goodAdapter, compliance: { basis: '', respectsSiteTerms: true, bypassesAccessControls: false } }))
      .toHaveLength(1);
  });

  it('rejects search snippets as engineering proof (Rule 4 of retrieval)', () => {
    const r = ingestCandidate(candidate({ sourceKind: 'searchSnippet' }), {
      ...goodAdapter,
      sourceKind: 'searchSnippet',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/not engineering proof/i);
  });

  it('ingests as importedUnverified and preserves URL and retrieval date', () => {
    const r = ingestCandidate(candidate(), goodAdapter);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.provenance.state).toBe('importedUnverified');
    expect(r.record.provenance.sourceUrl).toBe('https://example.com/catalog.pdf');
    expect(r.record.provenance.retrievedOn).toBe('2026-07-21');
    const p = findProperty(r.record, 'workingLoadLimit')!;
    expect(p.quantity.provenance.state).toBe('importedUnverified');
    expect(isVerified(p.quantity.provenance.state)).toBe(false);
  });

  it('lists critical ratings the user must verify (Rule 5 of retrieval)', () => {
    const r = ingestCandidate(candidate(), goodAdapter);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mustVerify.join(' ')).toMatch(/critical rating/i);
  });

  it('warns on distributor sources and missing dates', () => {
    const r = ingestCandidate(
      candidate({ sourceKind: 'distributorCatalog', publishedOn: undefined }),
      { ...goodAdapter, sourceKind: 'distributorCatalog' },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.join(' ')).toMatch(/distributor catalog/i);
    expect(r.warnings.join(' ')).toMatch(/publication date/i);
  });

  it('refuses a candidate with no retrieval date or no properties', () => {
    expect(ingestCandidate(candidate({ retrievedOn: '' }), goodAdapter).ok).toBe(false);
    expect(ingestCandidate(candidate({ properties: [] }), goodAdapter).ok).toBe(false);
  });

  it('ranks manufacturer documents above distributor summaries (Rule 10)', () => {
    const ranked = rankBySourceQuality([
      candidate({ sourceKind: 'distributorCatalog' }),
      candidate({ sourceKind: 'manufacturerDocument' }),
      candidate({ sourceKind: 'searchSnippet' }),
    ]);
    expect(ranked[0].sourceKind).toBe('manufacturerDocument');
    expect(ranked[ranked.length - 1].sourceKind).toBe('searchSnippet');
  });
});

describe('library audit warns about incomplete and ambiguous data', () => {
  it('flags missing property values and duplicate part numbers', () => {
    const withGap: ComponentRecord = {
      ...verifiedRecord('rec-gap'),
      properties: [
        {
          key: 'workingLoadLimit',
          label: 'Working load limit',
          quantity: { value: null, dimension: 'force', unit: 'N', provenance: { state: 'missing' } },
        },
      ],
    };
    const a = mergeRecord(createLibrary('L', '2026-01-01T00:00:00.000Z'), withGap);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = mergeRecord(a.library, { ...verifiedRecord('rec-dup'), partNumber: 'ERC-1234' });
    expect(b.ok).toBe(true);
    if (!b.ok) return;

    const warnings = auditLibrary(b.library, '2026-07-21T00:00:00.000Z');
    expect(warnings.some((w) => /is not entered/i.test(w.message))).toBe(true);
    expect(warnings.some((w) => /duplicates part number/i.test(w.message))).toBe(true);
  });

  it('flags documents older than five years', () => {
    const old = { ...verifiedRecord('rec-old'), provenance: { state: 'manufacturerVerified' as const, publishedOn: '2015-01-01' } };
    const a = mergeRecord(createLibrary('L', '2026-01-01T00:00:00.000Z'), old);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const warnings = auditLibrary(a.library, '2026-07-21T00:00:00.000Z');
    expect(warnings.some((w) => /still current/i.test(w.message))).toBe(true);
  });
});
