import { useRef } from 'react';
import { useAppStore } from '../state/store';
import { exportScenarioJson, importScenarioJson } from '../models/scenarioSerialization';
import { downloadTextFile } from '../reports/csv';
import { APP_VERSION } from '../version';

/**
 * Scenario library controls: select, create, duplicate, rename,
 * delete, import (validated), and export as versioned JSON.
 */
export function ScenarioBar() {
  const scenarios = useAppStore((s) => s.scenarios);
  const activeId = useAppStore((s) => s.activeId);
  const scenario = useAppStore((s) => s.scenario);
  const setActive = useAppStore((s) => s.setActiveScenario);
  const createScenario = useAppStore((s) => s.createScenario);
  const duplicateScenario = useAppStore((s) => s.duplicateScenario);
  const renameScenario = useAppStore((s) => s.renameScenario);
  const deleteScenario = useAppStore((s) => s.deleteScenario);
  const addImported = useAppStore((s) => s.addImportedScenario);
  const fileInput = useRef<HTMLInputElement>(null);

  function onRename() {
    const name = window.prompt('New scenario name:', scenario.name);
    if (name !== null) renameScenario(activeId, name);
  }

  function onDelete() {
    if (window.confirm(`Delete scenario "${scenario.name}"? This cannot be undone.`)) {
      deleteScenario(activeId);
    }
  }

  function onExport() {
    const json = exportScenarioJson(scenario, APP_VERSION);
    const safeName = scenario.name.replace(/[^\w-]+/g, '_').slice(0, 60) || 'scenario';
    downloadTextFile(`${safeName}.talon.json`, json, 'application/json');
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importScenarioJson(String(reader.result ?? ''));
      if (result.ok) {
        addImported(result.scenario, result.migrationNotes);
      } else {
        window.alert(
          'Import rejected — the file failed validation:\n\n' + result.errors.slice(0, 8).join('\n'),
        );
      }
    };
    reader.onerror = () => window.alert('Import failed: the file could not be read.');
    reader.readAsText(file);
  }

  return (
    <div className="scenario-bar" role="toolbar" aria-label="Scenario library">
      <label>
        Scenario{' '}
        <select
          value={activeId}
          onChange={(e) => setActive(e.target.value)}
          aria-label="Active scenario"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.scenario.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={createScenario}>New</button>
      <button onClick={() => duplicateScenario(activeId)}>Duplicate</button>
      <button onClick={onRename}>Rename</button>
      <button onClick={onDelete}>Delete</button>
      <button onClick={onExport}>Export JSON</button>
      <button onClick={() => fileInput.current?.click()}>Import…</button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
