/**
 * Fixture Editor — Milestones 6A–6G.
 *
 * Hosts the generalized `Project`: identity/contents, the 2D graphical editor
 * (canvas + inspector), the template gallery, and the analysis-run panel with
 * honest fidelity/certification badges. It performs no engineering math (Rules
 * 2/7) — it reads store state, drives the pure edit/run operations, and
 * presents their results.
 */
import { useState, type ChangeEvent } from 'react';
import { useProjectStore } from '../state/projectStore';
import { isVerified, type VerificationState } from '../core/provenance';
import { runProjectAnalysis } from '../core/projectRun';
import { describeRun, verifyRunIntegrity, type AnalysisRun } from '../core/analysisRun';
import { importProjectJson, projectFromScenario } from '../core/projectSerialization';
import type { Project } from '../core/model';
import { useAppStore } from '../state/store';
import { APP_VERSION } from '../version';
import { TemplateGallery } from './TemplateGallery';
import { EditorCanvas } from './EditorCanvas';
import { ProjectDraftsPanel } from './ProjectDraftsPanel';

const STATE_LABEL: Record<VerificationState, string> = {
  manufacturerVerified: 'Manufacturer verified',
  userVerified: 'User verified',
  internallyTested: 'Internally tested',
  supplierListed: 'Supplier listed (not verified)',
  provisional: 'Provisional — unverified',
  estimated: 'Estimated',
  exampleOnly: 'Example only — unverified',
  importedUnverified: 'Imported — unverified',
  obsolete: 'Obsolete',
  missing: 'Missing',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function FixtureEditor() {
  const project = useProjectStore((s) => s.project);
  const notices = useProjectStore((s) => s.notices);
  const dismissNotices = useProjectStore((s) => s.dismissNotices);
  const resetToExampleProject = useProjectStore((s) => s.resetToExampleProject);
  const createFromTemplate = useProjectStore((s) => s.createFromTemplate);

  const isExample = project.templateData.cufts?.isUnverifiedExample ?? false;
  const overall = project.verification.overallState;

  const counts: { label: string; n: number }[] = [
    { label: 'Coordinate systems', n: project.coordinateSystems.length },
    { label: 'Nodes', n: project.nodes.length },
    { label: 'Elements', n: project.elements.length },
    { label: 'Materials', n: project.materials.length },
    { label: 'Supports', n: project.supports.length },
    { label: 'Constraints', n: project.constraints.length },
    { label: 'Loads', n: project.loads.length },
    { label: 'Load cases', n: project.loadCases.length },
    { label: 'Load combinations', n: project.loadCombinations.length },
    { label: 'Moving bodies', n: project.movingBodies.length },
    { label: 'Analysis cases', n: project.analysisCases.length },
    { label: 'Analysis runs', n: project.analysisRuns.length },
  ];

  return (
    <div className="single-col">
      {notices.length > 0 && (
        <div className="notices no-print" role="status">
          <ul>
            {notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <button onClick={dismissNotices}>Dismiss</button>
        </div>
      )}

      <section className="results-panel">
        <h2>
          Fixture Editor{' '}
          <span className="badge-unverified">FOUNDATION · READ-ONLY (6A)</span>
        </h2>
        <p className="note">
          Runtime preview of the generalized project model. Graphical editing,
          the template gallery, and solver runs are added in later work
          packages. The validated v1 CUFTS tabs are unaffected.
        </p>

        <table>
          <tbody>
            <tr>
              <td>Project</td>
              <td>
                {project.name}
                {isExample && <span className="badge-unverified"> UNVERIFIED EXAMPLE</span>}
              </td>
            </tr>
            <tr>
              <td>Fixture template</td>
              <td>
                {project.template.name} <span className="note">({project.template.id})</span>
              </td>
            </tr>
            <tr>
              <td>Project schema</td>
              <td className="num">v{project.schemaVersion}</td>
            </tr>
            <tr>
              <td>Revision</td>
              <td className="num">{project.revision}</td>
            </tr>
            <tr>
              <td>Created</td>
              <td>{formatDate(project.createdOn)}</td>
            </tr>
          </tbody>
        </table>
        {project.description && <p className="note">{project.description}</p>}
      </section>

      <section className="results-panel">
        <h2>Model geometry — 2D elevation</h2>
        <p className="note">
          Read-only view of the project's nodes and elements. Drag to pan, scroll
          to zoom, click a node or element to inspect it. Editing arrives in a
          later work package.
        </p>
        <EditorCanvas />
      </section>

      <AnalysisPanel project={project} />

      <section className="results-panel no-print">
        <details>
          <summary>New project from a fixture template</summary>
          <p className="note">
            Only implemented templates can be created. Planned templates are
            locked and show the milestone that delivers them — TALON never
            offers a fixture it cannot build. Creating a project replaces the
            one shown above.
          </p>
          <TemplateGallery onCreate={createFromTemplate} />
        </details>
      </section>

      <section className="results-panel">
        <h2>Model contents</h2>
        <table>
          <tbody>
            {counts.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td className="num">{c.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="results-panel">
        <h2>Data verification</h2>
        <table>
          <tbody>
            <tr>
              <td>Overall input state</td>
              <td>
                {STATE_LABEL[overall]}
                {!isVerified(overall) && (
                  <span className="badge-unverified"> NOT CERTIFIED</span>
                )}
              </td>
            </tr>
            <tr>
              <td>Engineer reviewed</td>
              <td>{project.verification.engineerReviewed ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td>Review status</td>
              <td>{project.verification.reviewStatus}</td>
            </tr>
          </tbody>
        </table>

        {project.verification.outstanding.length > 0 && (
          <>
            <p className="solver-warn-heading">Outstanding — requires verification</p>
            <div className="warnings-panel">
              <ul>
                {project.verification.outstanding.map((o, i) => (
                  <li key={i} className="warning">
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {project.assumptions.length > 0 && (
          <>
            <p className="solver-warn-heading">Modeling assumptions</p>
            <ul className="assumptions">
              {project.assumptions.map((a) => (
                <li key={a.id}>{a.statement}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <ProjectDraftsPanel />

      <ProjectFilePanel />

      <section className="results-panel no-print">
        <button onClick={resetToExampleProject}>Reset to CUFTS example project</button>
        <p className="note">Re-seeds the built-in example project.</p>
      </section>
    </div>
  );
}

function triggerDownload(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project';

/**
 * Project file I/O and v1-scenario migration (6H). Export/import go through the
 * validated `projectSerialization` path: a malformed file is rejected with a
 * visible reason (never silently accepted), imports disclose migration notes,
 * and a v1 scenario becomes a CUFTS project with no data loss.
 */
function ProjectFilePanel() {
  const project = useProjectStore((s) => s.project);
  const toProjectJson = useProjectStore((s) => s.toProjectJson);
  const applyImportedProject = useProjectStore((s) => s.applyImportedProject);
  const v1Scenario = useAppStore((s) => s.scenario);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const onExport = () => {
    triggerDownload(`${slug(project.name)}.talon-project.json`, toProjectJson());
    setError(null);
    setOkMsg('Downloaded the active project as JSON.');
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError('Could not read the selected file.');
      setOkMsg(null);
      return;
    }
    const result = importProjectJson(text);
    if (result.ok) {
      applyImportedProject(
        result.project,
        result.migrationNotes.map((n) => `Import "${file.name}": ${n}`),
      );
      setError(null);
      setOkMsg(`Imported "${file.name}"${result.migrationNotes.length ? ' (see notes above)' : ''}.`);
    } else {
      setOkMsg(null);
      setError(`Could not import "${file.name}": ${result.errors.join(' ')}`);
    }
  };

  const onMigrateV1 = () => {
    const { project: migrated, migrationNotes } = projectFromScenario(v1Scenario);
    applyImportedProject(
      migrated,
      migrationNotes.map((n) => `Migrated v1 scenario: ${n}`),
    );
    setError(null);
    setOkMsg(`Migrated the active v1 scenario "${v1Scenario.name}" into a project.`);
  };

  return (
    <section className="results-panel no-print">
      <h2>Project file &amp; migration</h2>
      <div className="inspector-actions">
        <button type="button" onClick={onExport}>Download project JSON</button>
        <label className="file-import">
          Import project / scenario…
          <input type="file" accept="application/json,.json" onChange={onImportFile} />
        </label>
        <button type="button" onClick={onMigrateV1}>
          Migrate active v1 scenario → project
        </button>
      </div>
      <p className="note">
        Import accepts a TALON project file or a legacy v1 CUFTS scenario file;
        migration notes are disclosed and nothing is silently defaulted.
      </p>
      {okMsg && <p className="note" role="status">{okMsg}</p>}
      {error && (
        <p className="note" role="alert" style={{ color: 'var(--error)' }}>{error}</p>
      )}
    </section>
  );
}

const ACCEPT_CLASS: Record<string, string> = {
  'Acceptable (preliminary)': 'st-ok',
  Caution: 'st-caution',
  'NOT ACCEPTABLE': 'st-failed',
  'Insufficient information': 'st-insufficient',
};

/**
 * Runs the applicable analysis and shows the honest result badge (6G). The run
 * is frozen + fingerprinted; nothing here computes engineering results — it
 * calls `runProjectAnalysis` and renders its badge (Rules 2/6/7).
 */
function AnalysisPanel({ project }: { project: Project }) {
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = () => {
    const result = runProjectAnalysis(project, { appVersion: APP_VERSION, ranOn: new Date().toISOString() });
    if (result.ok) {
      setRun(result.run);
      setError(null);
    } else {
      setRun(null);
      setError(result.reason);
    }
  };

  const badge = run?.output.badge;

  return (
    <section className="results-panel">
      <h2>Analysis</h2>
      <div className="inspector-actions no-print">
        <button type="button" onClick={onRun}>Run analysis</button>
      </div>

      {error && <p className="note" role="status">{error}</p>}

      {run && badge && (
        <>
          <table className="result-badge">
            <tbody>
              <tr><td>Analysis level</td><td>{badge.analysisLevel}{badge.reducedOrder && <span className="note"> · reduced-order</span>}</td></tr>
              <tr><td>Solver</td><td>{badge.solver} v{badge.solverVersion}</td></tr>
              <tr><td>Validation</td><td>{badge.validation}</td></tr>
              <tr><td>Input confidence</td><td>{badge.inputConfidence}</td></tr>
              <tr><td>Applicability</td><td>{badge.applicability}</td></tr>
              <tr>
                <td>Result status</td>
                <td><span className={ACCEPT_CLASS[badge.acceptance] ?? ''}>{badge.acceptance}</span></td>
              </tr>
              <tr><td>Certification</td><td><span className="badge-unverified">{badge.certificationStatus}</span></td></tr>
              <tr><td>Convergence</td><td>{run.output.convergence}</td></tr>
              <tr><td>Run</td><td className="note">{run.id.length > 40 ? `${run.id.slice(0, 40)}…` : run.id} · fingerprint {run.fingerprint} · integrity {verifyRunIntegrity(run) ? 'ok' : 'FAILED'}</td></tr>
            </tbody>
          </table>

          <details>
            <summary>Result values ({run.output.scalars.length})</summary>
            <table>
              <tbody>
                {run.output.scalars.map((s) => (
                  <tr key={s.key}>
                    <td>{s.label}</td>
                    <td className="num">
                      {s.quantity.value === null
                        ? <span className="badge-locked">insufficient</span>
                        : `${trim(s.quantity.value)} ${s.quantity.unit === '1' ? '' : s.quantity.unit}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <details>
            <summary>Run header (traceability)</summary>
            <pre className="run-header">{describeRun(run).join('\n')}</pre>
          </details>
        </>
      )}
    </section>
  );
}

function trim(v: number): string {
  return Number(v.toFixed(3)).toString();
}
