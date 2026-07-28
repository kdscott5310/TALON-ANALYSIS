/**
 * Fixture inspector — Milestone 6E.
 *
 * Edits boundary conditions and loading on a custom (authoritative-geometry)
 * project: supports and constraints on the selected node, point-force loads,
 * and the grouping of loads into load cases and user-defined load combinations.
 * Every change commits immutably through the store; deletions cascade in
 * `projectEdits` so referential integrity is preserved.
 *
 * No engineering math (Rules 2/7): force inputs are only unit-converted for
 * storage. Load combinations never assume a building-code factor (Rule: M12).
 */
import { useState } from 'react';
import type { Project, SupportKind } from '../core/model';
import type { Selection } from './EditorCanvas';
import {
  addConstraint,
  addLoadCase,
  addLoadCombination,
  addMaterial,
  addPointForceLoad,
  removeConstraint,
  removeLoad,
  removeLoadCase,
  removeLoadCombination,
  removeSupport,
  setElementMaterial,
  setElementProperty,
  setMaterialProperty,
  setSupport,
  updatedQuantity,
} from '../core/projectEdits';
import { isMissing, isVerified, type Quantity, type VerificationState } from '../core/provenance';
import type { Dimension } from '../core/dimensions';
import {
  displayUnitLabel,
  formatForce,
  fromDisplayValue,
  lbfToN,
  toDisplayValue,
  type UnitSystem,
} from '../units/units';

interface PropSpec {
  key: string;
  label: string;
  dim: Dimension;
}

const CABLE_PROPS: PropSpec[] = [
  { key: 'diameter', label: 'Diameter', dim: 'length' },
  { key: 'linearMass', label: 'Linear mass', dim: 'linearDensity' },
  { key: 'minBreakingStrength', label: 'Min breaking strength', dim: 'force' },
  { key: 'designFactor', label: 'Design factor', dim: 'dimensionless' },
  { key: 'pretension', label: 'Pretension', dim: 'force' },
  { key: 'axialStiffness', label: 'Axial stiffness (EA)', dim: 'force' },
];

const MATERIAL_PROPS: PropSpec[] = [
  { key: 'elasticModulus', label: 'Elastic modulus', dim: 'pressure' },
  { key: 'density', label: 'Density', dim: 'density' },
];

const STATE_OPTIONS: VerificationState[] = [
  'provisional',
  'estimated',
  'supplierListed',
  'importedUnverified',
  'internallyTested',
  'userVerified',
  'manufacturerVerified',
];

const CABLE_TYPES = new Set(['cable', 'elasticCable', 'segmentedCable']);
const asQuantity = (o: object, key: string): Quantity | undefined =>
  (o as Record<string, unknown>)[key] as Quantity | undefined;

interface Props {
  project: Project;
  setProject: (p: Project) => void;
  selection: Selection;
  unitSystem: UnitSystem;
}

const SUPPORT_KINDS: SupportKind[] = ['fixed', 'pinned', 'roller', 'spring', 'prescribed'];
const forceUnit = (s: UnitSystem) => (s === 'us' ? 'lbf' : 'N');
const toN = (v: number, s: UnitSystem) => (s === 'us' ? lbfToN(v) : v);

export function FixtureInspector({ project, setProject, selection, unitSystem }: Props) {
  const node = selection?.kind === 'node' ? project.nodes.find((n) => n.id === selection.id) : undefined;
  const element = selection?.kind === 'edge' ? project.elements.find((e) => e.id === selection.id) : undefined;

  return (
    <div className="inspector">
      {node && (
        <NodeInspector project={project} setProject={setProject} nodeId={node.id} nodeName={node.name ?? node.id} unitSystem={unitSystem} />
      )}
      {element && (
        <ElementInspector project={project} setProject={setProject} element={element} unitSystem={unitSystem} />
      )}
      {!node && !element && (
        <p className="note">Select a node to edit supports/loads, or an element to edit its properties.</p>
      )}
      <LoadGrouping project={project} setProject={setProject} />
    </div>
  );
}

function ElementInspector({
  project,
  setProject,
  element,
  unitSystem,
}: {
  project: Project;
  setProject: (p: Project) => void;
  element: Project['elements'][number];
  unitSystem: UnitSystem;
}) {
  const props = CABLE_TYPES.has(element.type) ? CABLE_PROPS : [];
  const material = element.materialId
    ? project.materials.find((m) => m.id === element.materialId)
    : undefined;

  return (
    <div className="inspector-node">
      <h3>Element: {element.name ?? element.id} [{element.type}]</h3>

      <fieldset>
        <legend>Properties</legend>
        {props.length === 0 && <p className="note">No editable properties for this element type.</p>}
        {props.map((p) => (
          <PropertyRow
            key={`${element.id}:${p.key}`}
            spec={p}
            current={asQuantity(element, p.key)}
            unitSystem={unitSystem}
            onCommit={(q) => setProject(setElementProperty(project, element.id, p.key, q))}
          />
        ))}
      </fieldset>

      <fieldset>
        <legend>Material</legend>
        {material ? (
          <>
            <p className="note">{material.name}</p>
            {MATERIAL_PROPS.map((p) => (
              <PropertyRow
                key={`${material.id}:${p.key}`}
                spec={p}
                current={asQuantity(material, p.key)}
                unitSystem={unitSystem}
                onCommit={(q) => setProject(setMaterialProperty(project, material.id, p.key, q))}
              />
            ))}
            <div className="inspector-actions">
              <button type="button" onClick={() => setProject(setElementMaterial(project, element.id, undefined))}>
                Detach material
              </button>
            </div>
          </>
        ) : (
          <div className="inspector-actions">
            <button
              type="button"
              onClick={() => {
                const { project: p2, materialId } = addMaterial(project, { name: 'Material' });
                setProject(setElementMaterial(p2, element.id, materialId));
              }}
            >
              Add material
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function PropertyRow({
  spec,
  current,
  unitSystem,
  onCommit,
}: {
  spec: PropSpec;
  current: Quantity | undefined;
  unitSystem: UnitSystem;
  onCommit: (q: Quantity) => void;
}) {
  const missing = isMissing(current);
  const initValue =
    current && current.value !== null
      ? String(round6(toDisplayValue(current.value, spec.dim, unitSystem)))
      : '';
  const [valueStr, setValueStr] = useState(initValue);
  const [state, setState] = useState<VerificationState>(
    current?.provenance.state && current.provenance.state !== 'missing'
      ? current.provenance.state
      : 'provisional',
  );
  const unit = displayUnitLabel(spec.dim, unitSystem);

  const set = () => {
    const n = Number(valueStr);
    if (valueStr.trim() === '' || !Number.isFinite(n)) return;
    onCommit(updatedQuantity(current, fromDisplayValue(n, spec.dim, unitSystem), state, spec.dim));
  };
  const clear = () => onCommit(updatedQuantity(current, null, 'missing', spec.dim));

  return (
    <div className="prop-row">
      <span className="prop-label">
        {spec.label}
        {missing ? (
          <span className="badge-locked"> missing</span>
        ) : (
          current && !isVerified(current.provenance.state) && <span className="badge-locked"> unverified</span>
        )}
      </span>
      <input type="number" value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder="—" />
      {unit && <span className="prop-unit">{unit}</span>}
      <select value={state} onChange={(e) => setState(e.target.value as VerificationState)}>
        {STATE_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button type="button" onClick={set}>Set</button>
      {!missing && (
        <button type="button" className="link-btn" onClick={clear}>clear</button>
      )}
    </div>
  );
}

function round6(v: number): number {
  return Number(v.toFixed(6));
}

function NodeInspector({
  project,
  setProject,
  nodeId,
  nodeName,
  unitSystem,
}: {
  project: Project;
  setProject: (p: Project) => void;
  nodeId: string;
  nodeName: string;
  unitSystem: UnitSystem;
}) {
  const support = project.supports.find((s) => s.nodeId === nodeId);
  const [kind, setKind] = useState<SupportKind>(support?.kind ?? 'pinned');
  const [dof, setDof] = useState({
    x: support?.restrained.x ?? true,
    y: support?.restrained.y ?? true,
    z: support?.restrained.z ?? true,
  });
  const [fx, setFx] = useState('0');
  const [fz, setFz] = useState('0');
  const [tieTo, setTieTo] = useState('');

  const nodeLoads = project.loads.filter((l) => l.nodeId === nodeId);
  const nodeConstraints = project.constraints.filter((c) => c.nodeIds.includes(nodeId));
  const otherNodes = project.nodes.filter((n) => n.id !== nodeId);

  return (
    <div className="inspector-node">
      <h3>Node: {nodeName}</h3>

      <fieldset>
        <legend>Support</legend>
        <label className="inspector-field">
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as SupportKind)}>
            {SUPPORT_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <div className="inspector-dof">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <label key={axis}>
              <input type="checkbox" checked={dof[axis]} onChange={(e) => setDof({ ...dof, [axis]: e.target.checked })} />
              restrain {axis}
            </label>
          ))}
        </div>
        <div className="inspector-actions">
          <button type="button" onClick={() => setProject(setSupport(project, nodeId, { kind, restrained: dof }).project)}>
            {support ? 'Update support' : 'Set support'}
          </button>
          {support && (
            <button type="button" onClick={() => setProject(removeSupport(project, support.id))}>Clear support</button>
          )}
        </div>
        {support && <p className="note">Current: {support.kind} — restrains {dofLabel(support.restrained)}.</p>}
      </fieldset>

      <fieldset>
        <legend>Point-force loads ({forceUnit(unitSystem)})</legend>
        <ul className="inspector-list">
          {nodeLoads.length === 0 && <li className="note">No loads on this node.</li>}
          {nodeLoads.map((l) => (
            <li key={l.id}>
              {l.name}: Fx {formatForce(l.components?.x?.value ?? 0, unitSystem)}, Fz {formatForce(l.components?.z?.value ?? 0, unitSystem)}
              <button type="button" className="link-btn" onClick={() => setProject(removeLoad(project, l.id))}>remove</button>
            </li>
          ))}
        </ul>
        <div className="inspector-actions">
          <label className="inspector-field">Fx<input type="number" value={fx} onChange={(e) => setFx(e.target.value)} /></label>
          <label className="inspector-field">Fz<input type="number" value={fz} onChange={(e) => setFz(e.target.value)} /></label>
          <button
            type="button"
            onClick={() => {
              const x = Number(fx);
              const z = Number(fz);
              if (!Number.isFinite(x) || !Number.isFinite(z)) return;
              setProject(addPointForceLoad(project, { nodeId, fxN: toN(x, unitSystem), fzN: toN(z, unitSystem) }).project);
              setFx('0');
              setFz('0');
            }}
          >
            Add load
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Constraints</legend>
        <ul className="inspector-list">
          {nodeConstraints.length === 0 && <li className="note">No constraints on this node.</li>}
          {nodeConstraints.map((c) => (
            <li key={c.id}>
              {c.kind} [{c.nodeIds.join(', ')}]
              <button type="button" className="link-btn" onClick={() => setProject(removeConstraint(project, c.id))}>remove</button>
            </li>
          ))}
        </ul>
        {otherNodes.length > 0 && (
          <div className="inspector-actions">
            <label className="inspector-field">
              Tie DOF to
              <select value={tieTo} onChange={(e) => setTieTo(e.target.value)}>
                <option value="">— node —</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name ?? n.id}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!tieTo}
              onClick={() => {
                if (!tieTo) return;
                setProject(addConstraint(project, { kind: 'equalDof', nodeIds: [nodeId, tieTo] }).project);
                setTieTo('');
              }}
            >
              Add constraint
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function LoadGrouping({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const [caseName, setCaseName] = useState('');
  const [caseLoads, setCaseLoads] = useState<string[]>([]);
  const [comboName, setComboName] = useState('');
  const [comboCases, setComboCases] = useState<string[]>([]);

  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <div className="inspector-grouping">
      <fieldset>
        <legend>Load cases</legend>
        <ul className="inspector-list">
          {project.loadCases.length === 0 && <li className="note">No load cases.</li>}
          {project.loadCases.map((c) => (
            <li key={c.id}>
              {c.name} ({c.factors.length} load{c.factors.length === 1 ? '' : 's'})
              <button type="button" className="link-btn" onClick={() => setProject(removeLoadCase(project, c.id))}>remove</button>
            </li>
          ))}
        </ul>
        {project.loads.length > 0 && (
          <div className="inspector-actions inspector-create">
            <input type="text" placeholder="Load case name" value={caseName} onChange={(e) => setCaseName(e.target.value)} />
            <div className="inspector-checks">
              {project.loads.map((l) => (
                <label key={l.id}>
                  <input type="checkbox" checked={caseLoads.includes(l.id)} onChange={() => setCaseLoads((a) => toggle(a, l.id))} />
                  {l.name}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={!caseName.trim() || caseLoads.length === 0}
              onClick={() => {
                setProject(addLoadCase(project, { name: caseName.trim(), loadIds: caseLoads }).project);
                setCaseName('');
                setCaseLoads([]);
              }}
            >
              Create load case
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Load combinations (user-defined, unfactored)</legend>
        <ul className="inspector-list">
          {project.loadCombinations.length === 0 && <li className="note">No combinations.</li>}
          {project.loadCombinations.map((c) => (
            <li key={c.id}>
              {c.name} ({c.terms.length} case{c.terms.length === 1 ? '' : 's'})
              <button type="button" className="link-btn" onClick={() => setProject(removeLoadCombination(project, c.id))}>remove</button>
            </li>
          ))}
        </ul>
        {project.loadCases.length > 0 && (
          <div className="inspector-actions inspector-create">
            <input type="text" placeholder="Combination name" value={comboName} onChange={(e) => setComboName(e.target.value)} />
            <div className="inspector-checks">
              {project.loadCases.map((c) => (
                <label key={c.id}>
                  <input type="checkbox" checked={comboCases.includes(c.id)} onChange={() => setComboCases((a) => toggle(a, c.id))} />
                  {c.name}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={!comboName.trim() || comboCases.length === 0}
              onClick={() => {
                setProject(addLoadCombination(project, { name: comboName.trim(), loadCaseIds: comboCases }).project);
                setComboName('');
                setComboCases([]);
              }}
            >
              Create combination
            </button>
            <p className="note">No building-code factors are applied; terms are unit-weighted.</p>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function dofLabel(mask: { x: boolean; y: boolean; z: boolean }): string {
  const on = (['x', 'y', 'z'] as const).filter((a) => mask[a]);
  return on.length ? on.join('/') : 'none';
}
