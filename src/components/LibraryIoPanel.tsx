/**
 * Component-library import/export & source-adapter compliance — Milestone 7C.
 *
 * Export the library as JSON or CSV; import a library JSON or CSV file. Imports
 * MERGE into the current library via `mergeIncomingLibrary`, so a verified
 * record is never overwritten by unverified data (Rule 12) — refusals are
 * reported. CSV rows enter as `importedUnverified` and an empty cell is
 * *missing*, never 0 (Rule 3), handled by `libraryIo`. Malformed files are
 * rejected with a visible reason.
 *
 * The adapter section is read-only: it shows why online data is never trusted
 * automatically (no network adapter ships; search snippets are refused; an
 * adapter that bypasses access controls is refused). No engineering math
 * (Rules 2/7).
 */
import { useState, type ChangeEvent } from 'react';
import { useLibraryStore } from '../state/libraryStore';
import {
  exportLibraryCsv,
  exportLibraryJson,
  importLibraryCsv,
  importLibraryJson,
} from '../core/library/libraryIo';
import { mergeIncomingLibrary } from '../core/library/recordEdits';
import { BUILT_IN_ADAPTERS, validateAdapter } from '../core/library/sourceAdapters';
import { APP_VERSION } from '../version';

function download(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LibraryIoPanel() {
  const library = useLibraryStore((s) => s.library);
  const setLibrary = useLibraryStore((s) => s.setLibrary);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError('Could not read the selected file.');
      setOkMsg(null);
      return;
    }
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const result = isCsv ? importLibraryCsv(text, `Imported: ${file.name}`) : importLibraryJson(text);
    if (!result.ok) {
      setOkMsg(null);
      setError(`Could not import "${file.name}": ${result.errors.join(' ')}`);
      return;
    }
    const merged = mergeIncomingLibrary(library, result.library);
    const notes = [
      ...result.notes,
      ...merged.notes,
      ...merged.refused.map((r) => `Refused ${r.id}: ${r.reason}`),
    ].map((n) => `Import "${file.name}": ${n}`);
    setLibrary(merged.library, notes);
    setError(null);
    setOkMsg(
      `Imported "${file.name}": ${merged.added} added, ${merged.updated} updated` +
        (merged.refused.length ? `, ${merged.refused.length} refused (see notes above)` : '') +
        (isCsv ? ' — CSV rows are importedUnverified.' : '') + '.',
    );
  };

  return (
    <section className="results-panel no-print">
      <h2>Import / export &amp; sources</h2>
      <div className="inspector-actions">
        <button type="button" onClick={() => download(`${slug(library.name)}.library.json`, exportLibraryJson(library, APP_VERSION), 'application/json')}>
          Export JSON
        </button>
        <button type="button" onClick={() => download(`${slug(library.name)}.library.csv`, exportLibraryCsv(library), 'text/csv')}>
          Export CSV
        </button>
        <label className="file-import">
          Import library (JSON or CSV)…
          <input type="file" accept=".json,.csv,application/json,text/csv" onChange={onImport} />
        </label>
      </div>
      <p className="note">
        Imports merge into the current library; a verified record is never
        overwritten by unverified data. CSV cannot assert verification — every
        imported row is <strong>importedUnverified</strong> and an empty cell is
        recorded as <strong>missing</strong>, never 0.
      </p>
      {okMsg && <p className="note" role="status">{okMsg}</p>}
      {error && <p className="note" role="alert" style={{ color: 'var(--error)' }}>{error}</p>}

      <details>
        <summary>Online data sources &amp; compliance</summary>
        <p className="note">
          No network adapter ships in this build. Online/imported data is always
          <strong> importedUnverified</strong>, its URL and retrieval date are kept, search
          snippets are refused as engineering proof, and any adapter that bypasses a
          site&apos;s access controls or terms is refused. Verify every critical rating
          against the current manufacturer document before design use.
        </p>
        <table>
          <tbody>
            <tr><td className="note">Adapter</td><td className="note">Source</td><td className="note">Compliance basis</td><td className="note">Network</td><td className="note">Accepted?</td></tr>
            {BUILT_IN_ADAPTERS.map((a) => {
              const errs = validateAdapter(a);
              return (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.sourceKind}</td>
                  <td>{a.compliance.basis}</td>
                  <td>{a.networkEnabled ? 'enabled' : 'disabled'}</td>
                  <td>
                    {errs.length === 0
                      ? <span className="badge-ok">accepted</span>
                      : <span className="badge-unverified">refused</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </section>
  );
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'library';
