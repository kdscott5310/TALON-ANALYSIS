/**
 * Engineering standards manager — Milestone 9A.
 *
 * View and edit the shared standards document (design factors, allowable limits,
 * verification policy, load-combination templates), and export/import it as JSON
 * so a team keeps it consistent by versioning the file in a shared Git repo.
 * Edits are made on a draft and committed with Save; import/reset adopt
 * immediately. No engineering math (Rules 2/7); starter-template standards are
 * flagged as not authoritative until approved.
 */
import { useState, type ChangeEvent } from 'react';
import { useStandardsStore } from '../state/standardsStore';
import { useAppStore } from '../state/store';
import {
  checkStandards,
  createDefaultStandards,
  removeAllowableLimit,
  removeCombinationTemplate,
  removeDesignFactor,
  setAllowableLimit,
  setDesignFactor,
  updateStandardsMeta,
  type AllowableLimitEntry,
  type DesignFactorEntry,
  type Standards,
} from '../core/standards';
import { exportStandardsJson, importStandardsJson } from '../core/standardsIo';
import { STATE_LABEL, type VerificationState } from '../core/provenance';
import {
  displayUnitLabel,
  fromDisplayValue,
  toDisplayValue,
  type UnitSystem,
} from '../units/units';
import { APP_VERSION } from '../version';

const STATE_OPTIONS: VerificationState[] = [
  'provisional', 'estimated', 'supplierListed', 'internallyTested', 'userVerified', 'manufacturerVerified',
];

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'standards';

export function StandardsPanel() {
  const stored = useStandardsStore((s) => s.standards);
  const notices = useStandardsStore((s) => s.notices);
  const dismissNotices = useStandardsStore((s) => s.dismissNotices);
  const setStandards = useStandardsStore((s) => s.setStandards);
  const resetToStarter = useStandardsStore((s) => s.resetToStarter);
  const unitSystem = useAppStore((s) => s.unitSystem);

  const [draft, setDraft] = useState<Standards>(stored);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const meta = (patch: Parameters<typeof updateStandardsMeta>[1]) => setDraft((d) => updateStandardsMeta(d, patch));
  const issues = checkStandards(draft);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const result = importStandardsJson(text);
    if (!result.ok) {
      setError(`Could not import "${file.name}": ${result.errors.join(' ')}`);
      setOkMsg(null);
      return;
    }
    setDraft(result.standards);
    setStandards(result.standards);
    setError(null);
    setOkMsg(`Imported standards "${result.standards.name}" (rev ${result.standards.revision}).`);
  };

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
          Engineering standards{' '}
          {draft.starterTemplate && <span className="badge-unverified">STARTER TEMPLATE — REVIEW REQUIRED</span>}
        </h2>
        <p className="note">
          Shared org standards. Edit, then <strong>Save</strong>; <strong>Export</strong> the JSON and
          commit it to your team’s Git repo so others can pull the latest. Import adopts a colleague’s
          file (a verified record is never downgraded elsewhere; here, an approved standard stays approved).
        </p>

        <div className="inspector-actions inspector-create">
          <label className="inspector-field">Name<input value={draft.name} onChange={(e) => meta({ name: e.target.value })} /></label>
          <label className="inspector-field">Revision<input value={draft.revision} onChange={(e) => meta({ revision: e.target.value })} /></label>
          <label className="inspector-field">Organization<input value={draft.organization ?? ''} onChange={(e) => meta({ organization: e.target.value || undefined })} /></label>
          <label className="inspector-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={!draft.starterTemplate} onChange={(e) => meta({ starterTemplate: !e.target.checked })} />
            approved standard (not a starter template)
          </label>
        </div>
        <div className="inspector-actions no-print">
          <button type="button" onClick={() => { setStandards(draft); setOkMsg('Standards saved.'); setError(null); }}>Save standards</button>
          <button type="button" onClick={() => { setDraft(stored); setOkMsg(null); setError(null); }}>Revert to saved</button>
          <button type="button" onClick={() => download(`${slug(draft.name)}.standards.json`, exportStandardsJson(draft, APP_VERSION))}>Export JSON</button>
          <label className="file-import">Import JSON…<input type="file" accept=".json,application/json" onChange={onImport} /></label>
          <button type="button" onClick={() => { resetToStarter(); setDraft(createDefaultStandards()); setError(null); setOkMsg('Reset to the starter template.'); }} title="Discard and reload the shipped starter template">Reset to starter</button>
        </div>
        <p className="note">Last updated {new Date(draft.updatedOn).toLocaleString()}.</p>
        {okMsg && <p className="note" role="status">{okMsg}</p>}
        {error && <p className="note" role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        {issues.filter((i) => i.severity === 'warning').length > 0 && (
          <div className="warnings-panel"><ul>{issues.filter((i) => i.severity === 'warning').map((w, i) => <li key={i} className="warning">{w.message}</li>)}</ul></div>
        )}
      </section>

      <section className="results-panel">
        <h2>Design factors</h2>
        <table><tbody>
          {draft.designFactors.map((d) => (
            <FactorRow key={d.key} entry={d}
              onChange={(e) => setDraft((s) => setDesignFactor(s, e))}
              onRemove={() => setDraft((s) => removeDesignFactor(s, d.key))} />
          ))}
        </tbody></table>
        <div className="inspector-actions">
          <button type="button" onClick={() => setDraft((s) => setDesignFactor(s, { key: `factor-${s.designFactors.length + 1}`, label: 'New factor', value: 2 }))}>Add factor</button>
        </div>
      </section>

      <section className="results-panel">
        <h2>Allowable limits</h2>
        <table><tbody>
          {draft.allowableLimits.map((l) => (
            <LimitRow key={l.key} entry={l} unitSystem={unitSystem}
              onChange={(e) => setDraft((s) => setAllowableLimit(s, e))}
              onRemove={() => setDraft((s) => removeAllowableLimit(s, l.key))} />
          ))}
        </tbody></table>
        <div className="inspector-actions">
          <button type="button" onClick={() => setDraft((s) => setAllowableLimit(s, { key: `limit-${s.allowableLimits.length + 1}`, label: 'New limit', valueSI: 0, dimension: 'length', kind: 'max' }))}>Add limit</button>
        </div>
      </section>

      <section className="results-panel">
        <h2>Verification policy</h2>
        <div className="inspector-actions inspector-create">
          <label className="inspector-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={draft.verificationPolicy.requireVerifiedForDesign}
              onChange={(e) => setDraft((s) => ({ ...s, verificationPolicy: { ...s.verificationPolicy, requireVerifiedForDesign: e.target.checked } }))} />
            require verified data for design
          </label>
          <label className="inspector-field">
            Minimum state for design
            <select value={draft.verificationPolicy.minimumStateForDesign}
              onChange={(e) => setDraft((s) => ({ ...s, verificationPolicy: { ...s.verificationPolicy, minimumStateForDesign: e.target.value as VerificationState } }))}>
              {STATE_OPTIONS.map((st) => <option key={st} value={st}>{STATE_LABEL[st]}</option>)}
            </select>
          </label>
        </div>
        <label className="inspector-field">
          Critical property keys (comma-separated)
          <input value={draft.verificationPolicy.criticalPropertyKeys.join(', ')}
            onChange={(e) => setDraft((s) => ({ ...s, verificationPolicy: { ...s.verificationPolicy, criticalPropertyKeys: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } }))} />
        </label>
      </section>

      <section className="results-panel">
        <h2>Load-combination templates</h2>
        <p className="note">No building-code factor is assumed; a template cites a standard only when set. Full term editing lands with the load-case UI.</p>
        {draft.loadCombinationTemplates.length === 0 && <p className="note">No templates.</p>}
        <ul className="inspector-list">
          {draft.loadCombinationTemplates.map((c) => (
            <li key={c.name}>
              <strong>{c.name}</strong>{c.standard ? ` [${c.standard.name} ${c.standard.revision}]` : ' (unfactored)'} — {c.terms.map((t) => `${t.loadCaseKind}×${t.factor}`).join(', ')}
              <button type="button" className="link-btn" onClick={() => setDraft((s) => removeCombinationTemplate(s, c.name))}>remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="results-panel">
        <h2>How syncing works</h2>
        <p className="note">
          TALON is a client-only app — it reads and writes files, it does not talk to a server.
          To share standards: one engineer edits and <strong>Exports</strong> the JSON, commits it to
          your shared Git repo, and pushes. Others <strong>pull</strong> the repo and <strong>Import</strong>
          the file. Git history is the authoritative version trail; the “revision” field above is a human
          label. Two people editing the same file resolve conflicts like code.
        </p>
      </section>
    </div>
  );
}

function FactorRow({ entry, onChange, onRemove }: { entry: DesignFactorEntry; onChange: (e: DesignFactorEntry) => void; onRemove: () => void }) {
  const [label, setLabel] = useState(entry.label);
  const [valueStr, setValueStr] = useState(String(entry.value));
  const commit = () => {
    const v = Number(valueStr);
    onChange({ ...entry, label, value: Number.isFinite(v) ? v : entry.value });
  };
  return (
    <tr>
      <td><input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commit} style={{ minWidth: 200 }} /></td>
      <td><input type="number" value={valueStr} onChange={(e) => setValueStr(e.target.value)} onBlur={commit} style={{ width: 90 }} /></td>
      <td className="note">× design factor</td>
      <td><button type="button" className="link-btn" onClick={onRemove}>remove</button></td>
    </tr>
  );
}

function LimitRow({ entry, unitSystem, onChange, onRemove }: { entry: AllowableLimitEntry; unitSystem: UnitSystem; onChange: (e: AllowableLimitEntry) => void; onRemove: () => void }) {
  const [label, setLabel] = useState(entry.label);
  const [valueStr, setValueStr] = useState(String(round6(toDisplayValue(entry.valueSI, entry.dimension, unitSystem))));
  const unit = displayUnitLabel(entry.dimension, unitSystem);
  const commit = () => {
    const v = Number(valueStr);
    onChange({ ...entry, label, valueSI: Number.isFinite(v) ? fromDisplayValue(v, entry.dimension, unitSystem) : entry.valueSI });
  };
  return (
    <tr>
      <td><input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commit} style={{ minWidth: 200 }} /></td>
      <td><input type="number" value={valueStr} onChange={(e) => setValueStr(e.target.value)} onBlur={commit} style={{ width: 90 }} /></td>
      <td className="note">{unit || '—'} ({entry.kind})</td>
      <td><button type="button" className="link-btn" onClick={onRemove}>remove</button></td>
    </tr>
  );
}

function round6(v: number): number {
  return Number(v.toFixed(6));
}
