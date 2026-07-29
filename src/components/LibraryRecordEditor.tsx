/**
 * Component-record editor — Milestone 7B.
 *
 * Create records and edit their identity, provenance, and per-property values +
 * verification state. Edits are made on a DRAFT and committed once via
 * `mergeRecord`, which refuses to overwrite a verified record with unverified
 * data (Rule 12) — that refusal is surfaced to the user, never silently applied
 * or dropped. A missing value stays null (never 0, Rules 3/4); `updatedQuantity`
 * preserves the original source value (Rule 5). No engineering math (Rules 2/7).
 */
import { useState } from 'react';
import { useLibraryStore } from '../state/libraryStore';
import { useAppStore } from '../state/store';
import {
  markObsolete,
  mergeRecord,
  type ComponentProperty,
  type ComponentRecord,
} from '../core/library/componentLibrary';
import {
  blankRecord,
  removeRecordProperty,
  setRecordProperty,
  updateRecordFields,
  updateRecordProvenance,
} from '../core/library/recordEdits';
import { updatedQuantity } from '../core/projectEdits';
import { missing, type VerificationState } from '../core/provenance';
import type { ComponentCategory } from '../core/model';
import type { Dimension } from '../core/dimensions';
import {
  displayUnitLabel,
  fromDisplayValue,
  toDisplayValue,
  type UnitSystem,
} from '../units/units';

const CATEGORIES: ComponentCategory[] = [
  'wireRope', 'syntheticRope', 'cable', 'chain', 'shackle', 'masterLink', 'deltaRing', 'turnbuckle',
  'loadCell', 'dynamometer', 'sheave', 'snatchBlock', 'pulley', 'bearing', 'wheel', 'trolleyFrame',
  'brake', 'hydraulicCylinder', 'accumulator', 'shockAbsorber', 'winch', 'crane', 'portableMast',
  'ecologyBlock', 'ballast', 'groundAnchor', 'structuralSteel', 'aluminum', 'fastener', 'sensor',
  'camera', 'encoder', 'dataAcquisition', 'controller', 'safetyDevice',
];

const DIMENSIONS: Dimension[] = [
  'length', 'force', 'mass', 'linearDensity', 'dimensionless', 'energy', 'pressure', 'velocity', 'area', 'angle',
];

const STATE_OPTIONS: VerificationState[] = [
  'provisional', 'estimated', 'supplierListed', 'importedUnverified', 'internallyTested', 'userVerified', 'manufacturerVerified',
];

function slugKey(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

export function NewRecordForm() {
  const library = useLibraryStore((s) => s.library);
  const setLibrary = useLibraryStore((s) => s.setLibrary);
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('');
  const [category, setCategory] = useState<ComponentCategory>('cable');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    const recId = id.trim() || slugKey(name) || `record-${library.records.length + 1}`;
    const outcome = mergeRecord(library, blankRecord({ id: recId, category, name: name.trim() || recId }));
    if (outcome.ok) {
      setLibrary(outcome.library, outcome.notes.map((n) => `Library: ${n}`));
      setId('');
      setName('');
      setOpen(false);
      setError(null);
    } else {
      setError(outcome.reason);
    }
  };

  return (
    <section className="results-panel no-print">
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>New component record</summary>
        <div className="inspector-actions inspector-create">
          <label className="inspector-field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="inspector-field">Id (optional)<input value={id} onChange={(e) => setId(e.target.value)} placeholder="auto from name" /></label>
          <label className="inspector-field">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as ComponentCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" disabled={!name.trim() && !id.trim()} onClick={create}>Create record</button>
        </div>
        <p className="note">New records start as provisional (unverified). Add verified sources before design use.</p>
        {error && <p className="note" role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
      </details>
    </section>
  );
}

export function RecordEditor({ record, onClose }: { record: ComponentRecord; onClose: () => void }) {
  const library = useLibraryStore((s) => s.library);
  const setLibrary = useLibraryStore((s) => s.setLibrary);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const [draft, setDraft] = useState<ComponentRecord>(() => JSON.parse(JSON.stringify(record)));
  const [error, setError] = useState<string | null>(null);

  const field = (patch: Parameters<typeof updateRecordFields>[1]) => setDraft((d) => updateRecordFields(d, patch));
  const prov = (patch: Parameters<typeof updateRecordProvenance>[1]) => setDraft((d) => updateRecordProvenance(d, patch));

  const save = () => {
    const outcome = mergeRecord(library, draft, { summary: 'Edited in the record editor.' });
    if (outcome.ok) {
      setLibrary(outcome.library, outcome.notes.map((n) => `Library: ${n}`));
      onClose();
    } else {
      setError(outcome.reason);
    }
  };

  const obsolete = () => {
    setLibrary(markObsolete(library, record.id, 'Marked obsolete in the record editor.'));
    onClose();
  };

  return (
    <div className="inspector-node record-editor">
      <fieldset>
        <legend>Identity</legend>
        <label className="inspector-field">Name<input value={draft.name} onChange={(e) => field({ name: e.target.value })} /></label>
        <label className="inspector-field">Manufacturer<input value={draft.manufacturer ?? ''} onChange={(e) => field({ manufacturer: e.target.value || undefined })} /></label>
        <label className="inspector-field">Model<input value={draft.model ?? ''} onChange={(e) => field({ model: e.target.value || undefined })} /></label>
        <label className="inspector-field">Part number<input value={draft.partNumber ?? ''} onChange={(e) => field({ partNumber: e.target.value || undefined })} /></label>
      </fieldset>

      <fieldset>
        <legend>Provenance</legend>
        <label className="inspector-field">
          Verification state
          <select value={draft.provenance.state} onChange={(e) => prov({ state: e.target.value as VerificationState })}>
            {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="inspector-field">Source document<input value={draft.provenance.sourceDocument ?? ''} onChange={(e) => prov({ sourceDocument: e.target.value || undefined })} /></label>
        <label className="inspector-field">Source URL<input value={draft.provenance.sourceUrl ?? ''} onChange={(e) => prov({ sourceUrl: e.target.value || undefined })} /></label>
        <label className="inspector-field">Published on<input value={draft.provenance.publishedOn ?? ''} onChange={(e) => prov({ publishedOn: e.target.value || undefined })} placeholder="YYYY-MM-DD" /></label>
        <label className="inspector-field">Retrieved on<input value={draft.provenance.retrievedOn ?? ''} onChange={(e) => prov({ retrievedOn: e.target.value || undefined })} placeholder="YYYY-MM-DD" /></label>
      </fieldset>

      <fieldset>
        <legend>Properties</legend>
        {draft.properties.length === 0 && <p className="note">No properties yet.</p>}
        {draft.properties.map((p) => (
          <PropertyEditRow
            key={p.key}
            property={p}
            unitSystem={unitSystem}
            onApply={(np) => setDraft((d) => setRecordProperty(d, np))}
            onRemove={() => setDraft((d) => removeRecordProperty(d, p.key))}
          />
        ))}
        <AddPropertyForm unitSystem={unitSystem} onAdd={(np) => setDraft((d) => setRecordProperty(d, np))} />
      </fieldset>

      <div className="inspector-actions">
        <button type="button" onClick={save}>Save changes</button>
        <button type="button" onClick={onClose}>Cancel</button>
        {!draft.obsolete && <button type="button" onClick={obsolete}>Mark obsolete</button>}
      </div>
      {error && <p className="note" role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
    </div>
  );
}

function PropertyEditRow({
  property,
  unitSystem,
  onApply,
  onRemove,
}: {
  property: ComponentProperty;
  unitSystem: UnitSystem;
  onApply: (p: ComponentProperty) => void;
  onRemove: () => void;
}) {
  const dim = property.quantity.dimension;
  const [valueStr, setValueStr] = useState(
    property.quantity.value !== null ? String(round6(toDisplayValue(property.quantity.value, dim, unitSystem))) : '',
  );
  const [state, setState] = useState<VerificationState>(
    property.quantity.provenance.state !== 'missing' ? property.quantity.provenance.state : 'provisional',
  );
  const unit = displayUnitLabel(dim, unitSystem);

  const apply = () => {
    const n = Number(valueStr);
    const q = valueStr.trim() === '' || !Number.isFinite(n)
      ? missing(dim)
      : updatedQuantity(property.quantity, fromDisplayValue(n, dim, unitSystem), state, dim);
    onApply({ ...property, quantity: q });
  };

  return (
    <div className="prop-row">
      <span className="prop-label">{property.label}</span>
      <input type="number" value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder="— (missing)" />
      {unit && <span className="prop-unit">{unit}</span>}
      <select value={state} onChange={(e) => setState(e.target.value as VerificationState)}>
        {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="button" onClick={apply}>Apply</button>
      <button type="button" className="link-btn" onClick={onRemove}>remove</button>
    </div>
  );
}

function AddPropertyForm({ unitSystem, onAdd }: { unitSystem: UnitSystem; onAdd: (p: ComponentProperty) => void }) {
  const [label, setLabel] = useState('');
  const [dim, setDim] = useState<Dimension>('force');
  const [valueStr, setValueStr] = useState('');
  const [state, setState] = useState<VerificationState>('provisional');

  const add = () => {
    const key = slugKey(label);
    if (!key) return;
    const n = Number(valueStr);
    const q = valueStr.trim() === '' || !Number.isFinite(n)
      ? missing(dim)
      : updatedQuantity(undefined, fromDisplayValue(n, dim, unitSystem), state, dim);
    onAdd({ key, label: label.trim(), quantity: q });
    setLabel('');
    setValueStr('');
  };

  return (
    <div className="prop-row add-prop">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New property label" />
      <select value={dim} onChange={(e) => setDim(e.target.value as Dimension)}>
        {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <input type="number" value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder="value (or missing)" />
      <select value={state} onChange={(e) => setState(e.target.value as VerificationState)}>
        {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="button" disabled={!label.trim()} onClick={add}>Add property</button>
    </div>
  );
}

function round6(v: number): number {
  return Number(v.toFixed(6));
}
