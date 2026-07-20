import { useAppStore } from '../state/store';
import { useDynamics } from '../state/useDynamics';
import { buildReportData } from '../reports/reportData';
import { summaryCsv, timeHistoryCsv, downloadTextFile } from '../reports/csv';
import { formatItemValue, STATUS_LABEL } from './formatSummary';
import { SideView } from './SideView';
import { TimeHistoryCharts } from './TimeHistoryCharts';
import { APP_VERSION } from '../version';

/**
 * Printable engineering report: project metadata, input tables,
 * status summary with traceability, diagram, plots, warnings,
 * registers, and the validation disclaimer. Browser print/PDF via
 * window.print() — no server involved.
 */
export function ReportView() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const { result: dyn } = useDynamics(scenario);

  const report = buildReportData(scenario, APP_VERSION, unitSystem);
  const date = report.meta.generatedAt.slice(0, 10);

  function exportSummary() {
    downloadTextFile(
      `${scenario.name.replace(/[^\w-]+/g, '_').slice(0, 60)}_summary.csv`,
      summaryCsv(report.summary),
      'text/csv',
    );
  }

  function exportTimeHistory() {
    if (!dyn) return;
    downloadTextFile(
      `${scenario.name.replace(/[^\w-]+/g, '_').slice(0, 60)}_timehistory.csv`,
      timeHistoryCsv(dyn.sim),
      'text/csv',
    );
  }

  return (
    <div className="report-view">
      <div className="report-actions no-print">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <button onClick={exportSummary}>Export summary CSV</button>
        <button onClick={exportTimeHistory} disabled={!dyn}>
          Export time-history CSV
        </button>
      </div>

      <article className="report-page">
        <header className="report-header">
          <h1>{report.meta.title}</h1>
          <table className="report-meta">
            <tbody>
              <tr><td>Configuration</td><td>{report.meta.scenarioName}</td></tr>
              <tr><td>Report date</td><td>{date}</td></tr>
              <tr><td>Application revision</td><td>v{report.meta.appVersion} (schema v{report.meta.schemaVersion})</td></tr>
              <tr>
                <td>Data status</td>
                <td>
                  {report.meta.unverifiedExample
                    ? 'UNVERIFIED EXAMPLE — contains provisional placeholder data'
                    : 'User-entered data — verification status per registers below'}
                </td>
              </tr>
            </tbody>
          </table>
        </header>

        <section className="report-disclaimer">
          <strong>Preliminary estimate — not for construction or test authorization.</strong>{' '}
          {report.disclaimer}
        </section>

        <section>
          <h2>1. Results summary</h2>
          <p>
            Overall status:{' '}
            <strong className={`st-${report.summary.overall}`}>
              {STATUS_LABEL[report.summary.overall]}
            </strong>
            {report.summary.solverError && ` — ${report.summary.solverError}`}
          </p>
          <table className="report-table">
            <thead>
              <tr>
                <th>Check</th><th>Value</th><th>Status</th><th>Basis / limit</th><th>Solver</th><th>Assumptions</th>
              </tr>
            </thead>
            <tbody>
              {report.summary.items.map((item) => (
                <tr key={item.key}>
                  <td>{item.label}</td>
                  <td className={`st-${item.status}`}>{formatItemValue(item, unitSystem)}</td>
                  <td className={`st-${item.status}`}>{STATUS_LABEL[item.status]}</td>
                  <td className="small">{item.detail}</td>
                  <td className="small">{item.solver}</td>
                  <td className="small">{item.assumptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.summary.criticalWarnings.length > 0 && (
            <div className="report-critical">
              <h3>Critical warnings</h3>
              <ul>
                {report.summary.criticalWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2>2. System diagram</h2>
          <SideView />
        </section>

        <section>
          <h2>3. Dynamic time histories</h2>
          <TimeHistoryCharts />
          {!dyn && <p className="note">Simulation unavailable — fix input errors to include plots.</p>}
        </section>

        <section>
          <h2>4. Input configuration</h2>
          {report.inputs.map((sec) => (
            <div key={sec.title} className="report-input-section">
              <h3>{sec.title}</h3>
              <table className="report-table">
                <tbody>
                  {sec.rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>
                        {r.value}
                        {r.provisional && <span className="prov-flag"> PROVISIONAL</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <section>
          <h2>5. Validation issues</h2>
          {report.validationIssues.length === 0 ? (
            <p>No validation issues.</p>
          ) : (
            <ul>
              {report.validationIssues.map((i, idx) => (
                <li key={idx}>
                  <strong>{i.severity === 'error' ? 'ERROR' : 'Warning'}:</strong> {i.message}{' '}
                  <span className="small">({i.field})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="report-footer">
          {report.disclaimer} Generated {date} by TALON Engineering Suite v{report.meta.appVersion}.
        </footer>
      </article>
    </div>
  );
}
