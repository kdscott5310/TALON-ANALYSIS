/**
 * Fixture Editor — Milestone 6A (read-only foundation).
 *
 * Renders the generalized `Project` held by the project store. This is the
 * seam the graphical editor is built on: 6A only *displays* the Project
 * (identity, model contents, data-verification status); node/element editing
 * (6C–6E), the template gallery (6B), the property inspector (6F), and solver
 * runs with fidelity badges (6G) arrive in later packages.
 *
 * This component performs no engineering math (Rules 2/7) — it reads store
 * state and presents it.
 */
import { useProjectStore } from '../state/projectStore';
import { isVerified, type VerificationState } from '../core/provenance';
import { TemplateGallery } from './TemplateGallery';

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

      <section className="results-panel no-print">
        <button onClick={resetToExampleProject}>Reset to CUFTS example project</button>
        <p className="note">
          Re-seeds the built-in example project. In later packages this surface
          becomes the graphical fixture editor.
        </p>
      </section>
    </div>
  );
}
