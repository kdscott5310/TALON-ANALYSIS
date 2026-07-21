import { useAppStore, type WorkflowTab } from './state/store';
import { InputPanel } from './components/InputPanel';
import { SideView } from './components/SideView';
import { ResultsPanel } from './components/ResultsPanel';
import { WarningsPanel } from './components/WarningsPanel';
import { DynamicsPanel } from './components/DynamicsPanel';
import { SimControls } from './components/SimControls';
import { TimeHistoryCharts } from './components/TimeHistoryCharts';
import { ScenarioBar } from './components/ScenarioBar';
import { RegistersPanel } from './components/RegistersPanel';
import { CompareView } from './components/CompareView';
import { ReportView } from './components/ReportView';
import { ValidationView } from './components/ValidationView';
import { DISCLAIMER } from './models/scenario';

const TABS: { id: WorkflowTab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'static', label: 'Static Analysis' },
  { id: 'dynamic', label: 'Dynamic Analysis' },
  { id: 'compare', label: 'Compare' },
  { id: 'report', label: 'Report' },
  { id: 'validation', label: 'Validation' },
];

export default function App() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const setUnitSystem = useAppStore((s) => s.setUnitSystem);
  const resetToExample = useAppStore((s) => s.resetToExample);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const notices = useAppStore((s) => s.notices);
  const dismissNotices = useAppStore((s) => s.dismissNotices);

  return (
    <div className="app">
      <header className="header no-print">
        <div>
          <h1>TALON Engineering Suite — CUFTS Planner</h1>
          <p className="config-name">
            {scenario.name}
            {scenario.isUnverifiedExample && (
              <span className="badge-unverified"> UNVERIFIED EXAMPLE</span>
            )}
          </p>
        </div>
        <div className="header-controls">
          <label>
            Units{' '}
            <select
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as 'us' | 'si')}
              aria-label="Unit system"
            >
              <option value="us">US customary</option>
              <option value="si">SI</option>
            </select>
          </label>
          <button onClick={resetToExample}>Reset to example</button>
        </div>
      </header>

      <div className="no-print">
        <ScenarioBar />
      </div>

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

      <nav className="tab-nav no-print" role="tablist" aria-label="Workflow">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={activeTab === t.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'setup' && (
        <div className="main-grid">
          <InputPanel />
          <main className="viz-area">
            <SideView />
          </main>
          <div className="right-col">
            <WarningsPanel />
            <RegistersPanel />
          </div>
        </div>
      )}

      {activeTab === 'static' && (
        <div className="main-grid">
          <InputPanel />
          <main className="viz-area">
            <SideView />
          </main>
          <div className="right-col">
            <ResultsPanel />
            <WarningsPanel />
          </div>
        </div>
      )}

      {activeTab === 'dynamic' && (
        <div className="main-grid">
          <InputPanel />
          <main className="viz-area">
            <SideView />
            <SimControls />
            <TimeHistoryCharts />
          </main>
          <div className="right-col">
            <DynamicsPanel />
          </div>
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="single-col">
          <CompareView />
        </div>
      )}

      {activeTab === 'report' && (
        <div className="single-col">
          <ReportView />
        </div>
      )}

      {activeTab === 'validation' && <ValidationView />}

      <footer className="disclaimer no-print">{DISCLAIMER}</footer>
    </div>
  );
}
