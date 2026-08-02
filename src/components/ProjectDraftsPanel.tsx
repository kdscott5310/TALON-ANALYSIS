/**
 * Project drafts — Milestone 9B.
 *
 * Save the active project as a named draft, and load any draft back to continue
 * optimizing (newest first — "the latest draft" is at the top). Combined with
 * the 6H export/import, this is the git-based sharing workflow: export a draft,
 * commit it to the shared repo, colleagues pull and import it as a draft.
 *
 * No engineering math (Rules 2/7) — this is project bookkeeping.
 */
import { useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { draftsByRecency } from '../core/projectDrafts';
import { exportProjectJson } from '../core/projectSerialization';
import { APP_VERSION } from '../version';

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'draft';

export function ProjectDraftsPanel() {
  const drafts = useProjectStore((s) => s.drafts);
  const activeDraftId = useProjectStore((s) => s.activeDraftId);
  const saveDraft = useProjectStore((s) => s.saveDraft);
  const updateDraft = useProjectStore((s) => s.updateDraft);
  const loadDraft = useProjectStore((s) => s.loadDraft);
  const renameDraft = useProjectStore((s) => s.renameDraft);
  const duplicateDraft = useProjectStore((s) => s.duplicateDraft);
  const deleteDraft = useProjectStore((s) => s.deleteDraft);

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const ordered = draftsByRecency(drafts);

  return (
    <section className="results-panel no-print">
      <h2>Saved drafts</h2>
      <p className="note">
        Save named versions of this project and load one to continue optimizing.
        The newest is listed first. To share: <strong>Export</strong> a draft, commit it to your
        team’s Git repo, and push; colleagues pull and import it (Project file panel above).
      </p>

      <div className="inspector-actions inspector-create">
        <label className="inspector-field">Draft name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Higher pretension" /></label>
        <label className="inspector-field">Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="what changed" /></label>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => { saveDraft(name.trim(), note.trim() || undefined); setName(''); setNote(''); }}
        >
          Save as new draft
        </button>
        {activeDraftId && (
          <button type="button" onClick={() => updateDraft(activeDraftId, note.trim() || undefined)}>
            Update current draft
          </button>
        )}
      </div>

      {ordered.length === 0 ? (
        <p className="note">No saved drafts yet.</p>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr><th>Draft</th><th>Saved</th><th>Note</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {ordered.map((d, i) => (
                <tr key={d.id}>
                  <td>
                    {d.name}
                    {i === 0 && <span className="badge-ok"> latest</span>}
                    {d.id === activeDraftId && <span className="badge-locked"> active</span>}
                  </td>
                  <td className="cell-status">{new Date(d.savedOn).toLocaleString()}</td>
                  <td className="cell-note">{d.note ?? ''}</td>
                  <td>
                    <button type="button" className="link-btn" onClick={() => loadDraft(d.id)}>load</button>
                    <button type="button" className="link-btn" onClick={() => {
                      const next = prompt('Rename draft', d.name);
                      if (next) renameDraft(d.id, next);
                    }}>rename</button>
                    <button type="button" className="link-btn" onClick={() => duplicateDraft(d.id)}>duplicate</button>
                    <button type="button" className="link-btn" onClick={() => download(`${slug(d.name)}.talon-project.json`, exportProjectJson(d.project, APP_VERSION))}>export</button>
                    <button type="button" className="link-btn" onClick={() => deleteDraft(d.id)}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
