import { useAppStore } from './state/store';
import { InputPanel } from './components/InputPanel';
import { SideView } from './components/SideView';
import { ResultsPanel } from './components/ResultsPanel';
import { WarningsPanel } from './components/WarningsPanel';
import { DISCLAIMER } from './models/scenario';

export default function App() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const setUnitSystem = useAppStore((s) => s.setUnitSystem);
  const resetToExample = useAppStore((s) => s.resetToExample);

  return (
    <div className="app">
      <header className="header">
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
            <select value={unitSystem} onChange={(e) => setUnitSystem(e.target.value as 'us' | 'si')}>
              <option value="us">US customary</option>
              <option value="si">SI</option>
            </select>
          </label>
          <button onClick={resetToExample}>Reset to example</button>
        </div>
      </header>

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

      <footer className="disclaimer">{DISCLAIMER}</footer>
    </div>
  );
}
