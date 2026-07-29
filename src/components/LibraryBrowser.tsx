/**
 * Component Library browser — Milestone 7A (read-only).
 *
 * Lists the component library's records with a category filter, each record's
 * verification state, provenance summary, and the library audit warnings.
 * EXAMPLE-ONLY seed data is flagged prominently and never shown as verified
 * (Rules 4/6). Editing (7B) and import/export (7C) arrive next.
 *
 * No engineering math (Rules 2/7) — it reads store state and presents it.
 */
import { useMemo, useState } from 'react';
import { useLibraryStore } from '../state/libraryStore';
import {
  auditLibrary,
  isRecordVerified,
  recordVerificationState,
  type ComponentRecord,
} from '../core/library/componentLibrary';
import { STATE_LABEL, isVerified, type VerificationState } from '../core/provenance';
import { NewRecordForm, RecordEditor } from './LibraryRecordEditor';
import { LibraryIoPanel } from './LibraryIoPanel';
import { LibrarySizingPanel } from './LibrarySizingPanel';

const ALL = '__all__';

function stateBadgeClass(state: VerificationState): string {
  if (isVerified(state)) return 'badge-ok';
  if (state === 'exampleOnly' || state === 'missing' || state === 'obsolete') return 'badge-unverified';
  return 'badge-locked';
}

export function LibraryBrowser() {
  const library = useLibraryStore((s) => s.library);
  const notices = useLibraryStore((s) => s.notices);
  const dismissNotices = useLibraryStore((s) => s.dismissNotices);
  const resetToSeedLibrary = useLibraryStore((s) => s.resetToSeedLibrary);
  const [category, setCategory] = useState<string>(ALL);

  const categories = useMemo(
    () => Array.from(new Set(library.records.map((r) => r.category))).sort(),
    [library.records],
  );
  const shown = useMemo(
    () => library.records.filter((r) => category === ALL || r.category === category),
    [library.records, category],
  );
  const warnings = useMemo(() => auditLibrary(library), [library]);
  const warningsByRecord = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const w of warnings) {
      const list = m.get(w.recordId) ?? [];
      list.push(w.message);
      m.set(w.recordId, list);
    }
    return m;
  }, [warnings]);

  const verifiedCount = library.records.filter(isRecordVerified).length;

  return (
    <div className="single-col">
      {notices.length > 0 && (
        <div className="notices no-print" role="status">
          <ul>{notices.map((n, i) => <li key={i}>{n}</li>)}</ul>
          <button onClick={dismissNotices}>Dismiss</button>
        </div>
      )}

      <section className="results-panel">
        <h2>
          Component Library <span className="badge-unverified">EXAMPLE DATA</span>
        </h2>
        <p className="note">
          {library.name} · revision {library.revision} · {library.records.length} records ·{' '}
          {verifiedCount} verified. Seeded records are illustrative placeholders — not
          manufacturer data and never valid for design.
        </p>
        <div className="inspector-actions no-print">
          <label className="inspector-field">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value={ALL}>All ({library.records.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={resetToSeedLibrary}>Reset to example library</button>
        </div>
      </section>

      <LibrarySizingPanel />
      <LibraryIoPanel />
      <NewRecordForm />

      {shown.length === 0 ? (
        <p className="note">No records in this category.</p>
      ) : (
        shown.map((r) => (
          <RecordCard key={r.id} record={r} warnings={warningsByRecord.get(r.id) ?? []} />
        ))
      )}
    </div>
  );
}

function RecordCard({ record, warnings }: { record: ComponentRecord; warnings: string[] }) {
  const state = recordVerificationState(record);
  const verified = isRecordVerified(record);
  const p = record.provenance;
  const [editing, setEditing] = useState(false);

  return (
    <section className="results-panel">
      <h2 style={{ fontSize: '1rem' }}>
        {record.name}{' '}
        <span className={stateBadgeClass(state)}>{STATE_LABEL[state]}</span>
        {!verified && <span className="badge-unverified"> NOT FOR DESIGN</span>}
        <button type="button" className="link-btn no-print" onClick={() => setEditing((v) => !v)}>
          {editing ? 'close' : 'edit'}
        </button>
      </h2>

      {editing && <RecordEditor record={record} onClose={() => setEditing(false)} />}
      <p className="note">
        {record.category}
        {record.manufacturer ? ` · ${record.manufacturer}` : ''}
        {record.model ? ` ${record.model}` : ''}
        {record.partNumber ? ` (${record.partNumber})` : ''}
        {p.sourceDocument ? ` · source: ${p.sourceDocument}` : ''}
        {p.publishedOn ? ` · published ${p.publishedOn}` : ''}
      </p>

      {record.properties.length > 0 && (
        <table>
          <tbody>
            {record.properties.map((prop) => (
              <tr key={prop.key}>
                <td>{prop.label}</td>
                <td className="num">
                  {prop.quantity.value === null
                    ? <span className="badge-locked">not entered</span>
                    : `${trim(prop.quantity.value)} ${prop.quantity.unit === '1' ? '' : prop.quantity.unit}`}
                </td>
                <td className="note">{STATE_LABEL[prop.quantity.provenance.state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {warnings.length > 0 && (
        <div className="warnings-panel">
          <ul>
            {warnings.map((w, i) => (
              <li key={i} className="warning">{w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function trim(v: number): string {
  return Number(v.toPrecision(6)).toString();
}
